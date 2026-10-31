/**
 * Plain-language feedback after an agent submits a call report.
 * Raw server/database text (e.g. "violates check constraint") is never shown
 * to agents; validation messages written for agents are shown as-is.
 */
export type Bilingual = { bn: string; en: string };

export type ReportSaveFailure = {
  kind: "network" | "server" | "validation";
  /** True when sending the same report again may succeed. */
  retryable: boolean;
  message: Bilingual;
  /** Original text, for "show details" only. */
  detail: string;
};

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out|offline|ECONN|aborted/i;
const SERVER =
  /violates|constraint|relation "|column "|syntax error|duplicate key|PGRST|permission denied|internal server|server error|\b5\d\d\b|unexpected token|is not valid json|function .* does not exist|deadlock|could not serialize/i;

export function classifyReportSaveError(error: unknown): ReportSaveFailure {
  const detail = (error instanceof Error ? error.message : String(error ?? "")).trim();
  if (!detail || NETWORK.test(detail)) {
    return {
      kind: "network",
      retryable: true,
      detail,
      message: {
        bn: "সংযোগ সমস্যার কারণে রিপোর্ট সেভ হয়নি। আপনার উত্তরগুলো রাখা আছে — নেট দেখে আবার চেষ্টা করুন।",
        en: "The report didn't save because of a connection problem. Your answers are kept — check the internet and try again.",
      },
    };
  }
  if (SERVER.test(detail)) {
    return {
      kind: "server",
      retryable: true,
      detail,
      message: {
        bn: "সার্ভারে রিপোর্ট সেভ করা যায়নি। আপনার উত্তরগুলো রাখা আছে — আবার চেষ্টা করুন। বারবার হলে IT-কে জানান।",
        en: "The server couldn't save the report. Your answers are kept — try again. If it keeps happening, tell IT.",
      },
    };
  }
  return { kind: "validation", retryable: false, detail, message: { bn: detail, en: detail } };
}
