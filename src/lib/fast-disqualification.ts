/** Explicit rejection is outcome evidence, not six answered sales questions. */
export function fastDisqualification(category: string) {
  if (!["not_interested", "wrong_number", "fake"].includes(category)) return null;
  const fake = category === "fake";
  const reason = category === "not_interested" ? "Customer Not Interested" : fake ? "Fake / Invalid contact" : "Wrong Number";
  return {
    category: category === "not_interested" ? "not_interested" : "wrong_number",
    summary: reason,
    reason,
    interest: fake ? "fake" as const : "low" as const,
    requirement: null,
    customerResponse: category === "not_interested" ? "not_interested" : "other",
    nextAction: "no_action",
    followUpAt: null,
    followUpNeeded: false,
    followUpReason: null,
    followUpReasonNote: null,
    noFollowUpReason: fake ? "other" : category,
    followUpNote: reason,
    // Deterministic outcome classification, never a caller-selected grade.
    temperature: "cold" as const,
    grade: "D" as const,
    evaluationAnswers: null,
    retryPlan: null,
  };
}