/** Daily Lead Report auto-sync: every day 17:30 Asia/Dhaka (11:30 UTC). Browser-safe. */
export const LEAD_REPORT_UTC = { hour: 11, minute: 30 } as const;

export function nextLeadReportRun(now: Date): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), LEAD_REPORT_UTC.hour, LEAD_REPORT_UTC.minute));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
