/**
 * HQ daily WhatsApp report — shared pure rules.
 * Team and per-agent counts only; never customer names, phones or projects.
 */

export const HQ_REPORT_TEMPLATES = { text: "hq_daily_summary", pdf: "hq_daily_report_pdf" } as const;
export const HQ_REPORT_RECIPIENTS_KEY = "hq_daily_report_recipients";
export const HQ_REPORT_ENABLED_KEY = "hq_daily_report_enabled";

export type AgentDayRow = { name: string; received: number; reports: number; verifiedConnected: number; newFollowUps: number };
export type HqDayTotals = { received: number; reports: number; verifiedConnected: number; newFollowUps: number; activeAgents: number };

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const bnNum = (n: number | string) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);

const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
/** 2026-10-31 → "৩১ অক্টোবর ২০২৬" */
export function bnDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${bnNum(d ?? 0)} ${BN_MONTHS[(m ?? 1) - 1]} ${bnNum(y ?? 0)}`;
}

/** Agents with at least one submitted report count as active for the day. */
export function hqTotals(rows: AgentDayRow[]): HqDayTotals {
  return rows.reduce<HqDayTotals>((t, r) => ({
    received: t.received + r.received,
    reports: t.reports + r.reports,
    verifiedConnected: t.verifiedConnected + r.verifiedConnected,
    newFollowUps: t.newFollowUps + r.newFollowUps,
    activeAgents: t.activeAgents + (r.reports > 0 ? 1 : 0),
  }), { received: 0, reports: 0, verifiedConnected: 0, newFollowUps: 0, activeAgents: 0 });
}

/** Highest report count first, then name, so the PDF order is stable. */
export function sortAgentRows(rows: AgentDayRow[]): AgentDayRow[] {
  return [...rows].sort((a, b) => b.reports - a.reports || b.verifiedConnected - a.verifiedConnected || a.name.localeCompare(b.name));
}

/** Body variables for both templates, in order {{1}}…{{6}}. */
export function hqSummaryParams(day: string, t: HqDayTotals): string[] {
  return [bnDate(day), bnNum(t.received), bnNum(t.reports), bnNum(t.verifiedConnected), bnNum(t.newFollowUps), bnNum(t.activeAgents)];
}

export function normalizeRecipientList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const raw of value) {
    const digits = String(raw).replace(/[^\d]/g, "");
    if (/^8801[3-9]\d{8}$/.test(digits)) out.add(digits);
  }
  return [...out];
}

/** Splits text into runs so Bangla is shaped as Bangla and Latin as Latin. */
export function scriptRuns(text: string): Array<{ text: string; bengali: boolean }> {
  const runs: Array<{ text: string; bengali: boolean }> = [];
  for (const ch of text) {
    const isBn = /[\u0980-\u09FF\u200C\u200D]/u.test(ch);
    const neutral = /[\s\d.,:;()\-–—/%·]/u.test(ch);
    const last = runs[runs.length - 1];
    if (last && (last.bengali === isBn || neutral)) last.text += ch;
    else runs.push({ text: ch, bengali: isBn });
  }
  return runs;
}
