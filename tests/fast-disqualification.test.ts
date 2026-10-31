import { describe, expect, it } from "vitest";
import { fastDisqualification } from "@/lib/fast-disqualification";
import { validateReport } from "@/lib/call-reports.server";

describe("explicit fast rejection", () => {
  for (const category of ["not_interested", "wrong_number", "fake"]) {
    it(`${category} needs no requirements, questions or repeated follow-up choice`, () => {
      const result = fastDisqualification(category);
      expect(result).toMatchObject({ requirement: null, nextAction: "no_action", followUpAt: null, followUpNeeded: false, evaluationAnswers: null, temperature: null, grade: null });
      expect(validateReport({ ...result, category: result?.category ?? null, connected: true, requireCallFacts: true, direction: "outgoing", callStatus: "connected", durationSeconds: 3 })).toBeNull();
    });
  }
  it("fake preserves its reason without inventing a database category", () => {
    expect(fastDisqualification("fake")).toMatchObject({ category: "wrong_number", noFollowUpReason: "other", followUpNote: "Fake / Invalid contact", interest: "fake" });
  });
  it("no answer and qualification never enter rejection mode", () => {
    for (const category of ["no_answer", "callback", "interested", "hot_lead", "closed_converted"]) expect(fastDisqualification(category)).toBeNull();
  });
  it("a zero-duration connected rejection is still refused", () => {
    const result = fastDisqualification("not_interested");
    expect(validateReport({ ...result, category: "not_interested", connected: true, requireCallFacts: true, direction: "outgoing", callStatus: "connected", durationSeconds: 0 })?.field).toBe("durationSeconds");
  });
});