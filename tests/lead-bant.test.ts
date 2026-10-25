import { describe, expect, it } from "vitest";
import {
  BANT_MAX_TOTAL,
  BANT_WEIGHTS,
  bantBand,
  computeBantTotal,
  validateBantScore,
} from "@/lib/lead-bant";

const field = (score: number | null, evidence = "evidence") => ({
  score,
  evidence: score === null ? "" : evidence,
  confidence: "medium" as const,
});

describe("BANT weights", () => {
  it("uses the approved weights: Budget 25, Authority 20, Need 30, Timeline 25", () => {
    expect(BANT_WEIGHTS).toEqual({ budget: 25, authority: 20, need: 30, timeline: 25 });
    expect(BANT_MAX_TOTAL).toBe(100);
  });
});

describe("computeBantTotal", () => {
  it("weights each field and treats unknowns as zero", () => {
    const total = computeBantTotal({
      budget: field(80), // 20
      authority: field(50), // 10
      need: field(100), // 30
      timeline: field(null), // 0
    });
    expect(total).toBe(60);
  });

  it("scores zero when everything is unknown", () => {
    expect(
      computeBantTotal({
        budget: field(null),
        authority: field(null),
        need: field(null),
        timeline: field(null),
      }),
    ).toBe(0);
  });
});

describe("validateBantScore", () => {
  const valid = {
    budget: field(80),
    authority: field(50),
    need: field(100),
    timeline: field(null),
    total: 60,
  };

  it("accepts a well-formed score with a matching total", () => {
    const result = validateBantScore(valid);
    expect(result.ok).toBe(true);
  });

  it("rejects a hallucinated total that does not match the weights", () => {
    const result = validateBantScore({ ...valid, total: 95 });
    expect(result).toEqual({ ok: false, code: "TOTAL_MISMATCH" });
  });

  it("rejects a scored field that has no evidence", () => {
    const result = validateBantScore({
      ...valid,
      budget: { score: 80, evidence: "  ", confidence: "high" },
    });
    expect(result).toEqual({ ok: false, code: "UNKNOWN_HAS_SCORE" });
  });

  it("rejects malformed shapes and out-of-range scores", () => {
    expect(validateBantScore(null)).toEqual({ ok: false, code: "INVALID_SHAPE" });
    expect(validateBantScore({ ...valid, budget: field(120) })).toEqual({
      ok: false,
      code: "INVALID_SHAPE",
    });
    expect(validateBantScore({ ...valid, extra: true })).toEqual({
      ok: false,
      code: "INVALID_SHAPE",
    });
  });

  it("keeps unknowns unknown — null fields are valid and never guessed", () => {
    const result = validateBantScore({
      budget: field(null),
      authority: field(null),
      need: field(null),
      timeline: field(null),
      total: 0,
    });
    expect(result.ok).toBe(true);
  });
});

describe("bantBand", () => {
  it("never rejects — the lowest band asks for human review", () => {
    expect(bantBand(10).en).toContain("human review");
    expect(bantBand(50).en).toContain("moderate");
    expect(bantBand(80).en).toContain("strong");
  });
});
