/**
 * AI BANT scoring (server-only). Uses the shared AI helper — never a
 * parallel provider path — and stores only deterministic-validated results.
 * Scores are advisory: nothing here rejects or routes a lead.
 */
import { aiChatJson, getAiModelChoice } from "@/lib/ai-model.server";
import {
  BANT_MODEL_VERSION,
  validateBantScore,
  type BantScore,
} from "@/lib/lead-bant";

const SYSTEM_PROMPT = [
  "You score real-estate leads with BANT. Reply with ONLY strict JSON:",
  '{"budget":{"score":0-100|null,"evidence":"...","confidence":"low|medium|high"},',
  '"authority":{...},"need":{...},"timeline":{...},"total":0-100}.',
  "Rules: use null for any field the text does not support; never guess.",
  "Every non-null score must quote or paraphrase its evidence.",
  "total = round(budget*0.25 + authority*0.20 + need*0.30 + timeline*0.25),",
  "treating null fields as 0.",
].join(" ");

export type BantScoreResult =
  | { ok: true; scoreId: string; total: number }
  | { ok: false; code: "AI_UNAVAILABLE" | "AI_INVALID" | "STORE_FAILED"; reason: string };

/**
 * Score one lead's notes/source text and store the validated result in
 * lead_bant_scores (append-only, versioned). Callers decide when to score;
 * a failure here must never lose the lead itself.
 */
export async function scoreLeadBant(input: {
  leadId: string;
  leadText: string;
  createdBy?: string;
}): Promise<BantScoreResult> {
  let raw: unknown;
  try {
    raw = await aiChatJson<unknown>({
      system: SYSTEM_PROMPT,
      user: `Lead text:\n${input.leadText.slice(0, 4000)}`,
    });
  } catch (error) {
    return {
      ok: false,
      code: "AI_UNAVAILABLE",
      reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    };
  }

  const validation = validateBantScore(raw);
  if (!validation.ok) return { ok: false, code: "AI_INVALID", reason: validation.code };
  const score: BantScore = validation.score;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("lead_bant_scores")
    .insert({
      lead_id: input.leadId,
      model: `${BANT_MODEL_VERSION}:${getAiModelChoice()}`,
      budget: score.budget.score,
      authority: score.authority.score,
      need: score.need.score,
      timeline: score.timeline.score,
      total: score.total,
      evidence: {
        budget: score.budget,
        authority: score.authority,
        need: score.need,
        timeline: score.timeline,
      },
      confidence: null,
      created_by: input.createdBy ?? "pipeline",
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, code: "STORE_FAILED", reason: error?.message ?? "no row" };
  }
  return { ok: true, scoreId: data.id, total: score.total };
}

/** Latest BANT total per lead, for the Nexus preview score signal. */
export async function latestBantTotals(
  leadIds: string[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (leadIds.length === 0) return totals;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("lead_bant_scores")
    .select("lead_id,total,created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });
  for (const row of data ?? []) {
    if (!totals.has(row.lead_id)) totals.set(row.lead_id, row.total);
  }
  return totals;
}
