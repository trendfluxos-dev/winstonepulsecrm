/**
 * AI BANT scoring — pure, browser-safe rules. Budget 25 / Authority 20 /
 * Need 30 / Timeline 25. Unknown fields stay null and score zero: the model
 * must never guess. A deterministic validator re-computes the weighted total
 * and rejects any mismatch, so a hallucinated total can never be stored.
 * Scores are advisory — low scores go to human review, never auto-rejection.
 */
import { z } from "zod";

export const BANT_WEIGHTS = { budget: 25, authority: 20, need: 30, timeline: 25 } as const;
export const BANT_MAX_TOTAL = 100;
export const BANT_MODEL_VERSION = "bant_v1";

export type BantField = keyof typeof BANT_WEIGHTS;

export type BantFieldScore = {
  /** 0–100 strength of this signal; null when unknown. */
  score: number | null;
  /** Quoted/paraphrased evidence from the source text; empty when unknown. */
  evidence: string;
  confidence: "low" | "medium" | "high";
};

export type BantScore = {
  budget: BantFieldScore;
  authority: BantFieldScore;
  need: BantFieldScore;
  timeline: BantFieldScore;
  total: number;
};

const fieldSchema = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  evidence: z.string().max(500),
  confidence: z.enum(["low", "medium", "high"]),
});

export const bantScoreSchema = z
  .object({
    budget: fieldSchema,
    authority: fieldSchema,
    need: fieldSchema,
    timeline: fieldSchema,
    total: z.number().int().min(0).max(BANT_MAX_TOTAL),
  })
  .strict();

/** Deterministic total: unknown (null) fields contribute zero. */
export function computeBantTotal(score: Pick<BantScore, BantField>): number {
  let total = 0;
  for (const field of Object.keys(BANT_WEIGHTS) as BantField[]) {
    const value = score[field].score;
    if (value !== null) total += Math.round((value * BANT_WEIGHTS[field]) / 100);
  }
  return total;
}

export type BantValidation =
  | { ok: true; score: BantScore }
  | { ok: false; code: "INVALID_SHAPE" | "TOTAL_MISMATCH" | "UNKNOWN_HAS_SCORE" };

/**
 * Validate an AI-produced BANT result before it may be stored. Shape must
 * match exactly, the stated total must equal the deterministic recomputation,
 * and every field must carry evidence when it carries a score.
 */
export function validateBantScore(raw: unknown): BantValidation {
  const parsed = bantScoreSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "INVALID_SHAPE" };
  const score = parsed.data as BantScore;
  for (const field of Object.keys(BANT_WEIGHTS) as BantField[]) {
    const entry = score[field];
    // A scored field without any evidence is a guess — refuse it.
    if (entry.score !== null && entry.evidence.trim().length === 0) {
      return { ok: false, code: "UNKNOWN_HAS_SCORE" };
    }
  }
  if (computeBantTotal(score) !== score.total) return { ok: false, code: "TOTAL_MISMATCH" };
  return { ok: true, score };
}

/** Advisory band for display only; never used to reject a lead. */
export function bantBand(total: number): { bn: string; en: string } {
  if (total >= 70) return { bn: "শক্তিশালী সম্ভাবনা", en: "strong prospect" };
  if (total >= 40) return { bn: "মাঝারি সম্ভাবনা", en: "moderate prospect" };
  return { bn: "মানুষের পর্যালোচনা দরকার", en: "needs human review" };
}
