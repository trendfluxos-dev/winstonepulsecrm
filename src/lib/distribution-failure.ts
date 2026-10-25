export const FAILURE_REASONS = {
  timeout: { bn: "বণ্টনের অনুরোধ নির্ধারিত সময়ের মধ্যে শেষ হয়নি।", en: "Distribution exceeded the allowed time." },
  quota: { bn: "এজেন্টের দৈনিক ৫০-লিড সীমা পূর্ণ হয়েছে।", en: "An agent reached the daily 50-lead limit." },
  no_agents: { bn: "বণ্টনের জন্য সক্রিয় অনুমোদিত এজেন্ট নেই।", en: "No active approved agents are available." },
  connection: { bn: "তথ্যসেবার সঙ্গে সংযোগ ব্যর্থ হয়েছে।", en: "The data service could not be reached." },
  access: { bn: "বণ্টনের প্রয়োজনীয় অনুমতি যাচাই ব্যর্থ হয়েছে।", en: "Required distribution access could not be verified." },
  unknown: { bn: "বণ্টনের একটি ধাপ ব্যর্থ হয়েছে; IT যাচাই প্রয়োজন।", en: "A distribution step failed; IT investigation is required." },
} as const;
export type FailureReason = keyof typeof FAILURE_REASONS;
export type DistributionStage = "prepare" | "rollover" | "plan" | "pool" | "assign" | "save_plan";
export function safeDistributionReason(error: unknown): FailureReason {
  const text = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  if (/timeout|timed out|statement timeout|canceling statement/i.test(text)) return "timeout";
  if (/daily lead cap|50 leads per agent/i.test(text)) return "quota";
  if (/চালু কোনো এজেন্ট নেই|no active.*agent/i.test(text)) return "no_agents";
  if (/fetch failed|network|connection|ECONN/i.test(text)) return "connection";
  if (/permission denied|not authorized|PIN required/i.test(text)) return "access";
  return "unknown";
}
export function parseFailureDetail(raw: string | null): { reason: FailureReason; stage: DistributionStage } {
  try {
    const value = JSON.parse(raw ?? "{}");
    const reasons: string[] = Object.keys(FAILURE_REASONS);
    const stages: string[] = ["prepare", "rollover", "plan", "pool", "assign", "save_plan"];
    return { reason: reasons.includes(value.reason) ? value.reason : "unknown", stage: stages.includes(value.stage) ? value.stage : "prepare" };
  } catch { return { reason: "unknown", stage: "prepare" }; }
}