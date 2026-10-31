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
    // A non-sales disposition is not a Cold/D sales evaluation.
    temperature: null,
    grade: null,
    evaluationAnswers: null,
    retryPlan: null,
  };
}
/** FAKE LEAD is only known from a conversation; an unanswered call cannot prove it. */
export const FAKE_NEEDS_ANSWERED_CALL = {
  bn: "কল ধরা না হলে FAKE LEAD দেওয়া যাবে না — কথা বলে নিশ্চিত হলে তবেই ভুয়া লিড দিন। কেউ না ধরলে NO ANSWER (ধরেনি) বাছাই করুন।",
  en: "FAKE LEAD needs an answered call. If nobody picked up, choose NO ANSWER instead.",
} as const;

export function fakeNeedsAnsweredCall(category: string | null | undefined, connected: boolean): boolean {
  return category === "fake" && !connected;
}
