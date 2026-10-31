/**
 * Agent desk queue order and attempt numbering (pure, shared by UI + tests).
 *
 * Order inside the "priority" sort:
 *   0. overdue real follow-ups (customer asked to be called back)
 *   1. fresh leads that have never been called or reported
 *   2. retries — did-not-receive / busy / already-called leads — at the BACK,
 *      oldest last attempt first so they rotate instead of sticking on top.
 *
 * Attempts shown to the agent are never lower than the saved reports on that
 * lead: max(leads.call_attempts, submitted reports). No invented numbers.
 */

export type QueueLead = {
  id: string;
  status: string;
  work_state?: string | null;
  retry_after?: string | null;
  last_call_at?: string | null;
  outcome_category?: string | null;
  unanswered_attempts?: number | null;
  call_attempts?: number | null;
  temperature?: string | null;
  serial_no?: string | null;
  created_at?: string;
};

export type ReportRow = { lead_id: string | null; submitted_at: string | null; category?: string | null; connected?: boolean | null };

export type LeadReportSummary = { count: number; lastAt: string; lastCategory: string | null; lastConnected: boolean | null };

export const RETRY_OUTCOMES = new Set(["no_answer", "busy", "failed"]);

export function summarizeReports(rows: readonly ReportRow[]): Map<string, LeadReportSummary> {
  const out = new Map<string, LeadReportSummary>();
  for (const r of rows) {
    if (!r.lead_id || !r.submitted_at) continue;
    const prev = out.get(r.lead_id);
    if (!prev) {
      out.set(r.lead_id, { count: 1, lastAt: r.submitted_at, lastCategory: r.category ?? null, lastConnected: r.connected ?? null });
      continue;
    }
    prev.count += 1;
    if (Date.parse(r.submitted_at) > Date.parse(prev.lastAt)) {
      prev.lastAt = r.submitted_at;
      prev.lastCategory = r.category ?? null;
      prev.lastConnected = r.connected ?? null;
    }
  }
  return out;
}

export function attemptCount(lead: Pick<QueueLead, "call_attempts">, summary?: LeadReportSummary | null): number {
  return Math.max(lead.call_attempts ?? 0, summary?.count ?? 0);
}

/** The last saved outcome was "did not receive" (no answer / busy / failed). */
export function lastWasNotReceived(lead: QueueLead, summary?: LeadReportSummary | null): boolean {
  const cat = summary?.lastCategory ?? lead.outcome_category ?? null;
  if (cat && RETRY_OUTCOMES.has(cat)) return true;
  return (lead.unanswered_attempts ?? 0) > 0 && lead.work_state !== "completed";
}

export function queueBucket(lead: QueueLead, summary: LeadReportSummary | null | undefined, now: number): 0 | 1 | 2 {
  const retry =
    lastWasNotReceived(lead, summary) ||
    lead.work_state === "snoozed" ||
    lead.work_state === "unresponsive" ||
    (lead.status === "pending" && (Boolean(lead.last_call_at) || attemptCount(lead, summary) > 0));
  if (retry) return 2;
  if (lead.status === "follow_up" && lead.retry_after && Date.parse(lead.retry_after) < now) return 0;
  return 1;
}

const tempRank = (t?: string | null) => (t === "hot" ? 0 : t === "warm" ? 1 : 2);
const lastTouch = (l: QueueLead, s?: LeadReportSummary | null) => {
  const a = l.last_call_at ? Date.parse(l.last_call_at) : 0;
  const b = s ? Date.parse(s.lastAt) : 0;
  return Math.max(a, b);
};

export function compareQueue(
  a: QueueLead,
  b: QueueLead,
  summaries: ReadonlyMap<string, LeadReportSummary>,
  now: number,
): number {
  const sa = summaries.get(a.id);
  const sb = summaries.get(b.id);
  const ba = queueBucket(a, sa, now);
  const bb = queueBucket(b, sb, now);
  if (ba !== bb) return ba - bb;
  if (ba === 0) return Date.parse(a.retry_after!) - Date.parse(b.retry_after!);
  if (ba === 2) return lastTouch(a, sa) - lastTouch(b, sb);
  const byTemp = tempRank(a.temperature) - tempRank(b.temperature);
  if (byTemp !== 0) return byTemp;
  return (a.serial_no ?? "").localeCompare(b.serial_no ?? "", "bn", { numeric: true });
}

/**
 * Lead details panel: attempts and last attempt from this lead's own saved
 * reports (submitted only), never lower than the stored call counter.
 */
export function leadAttemptInfo(
  lead: { call_attempts?: number | null; last_call_at?: string | null },
  reports: readonly { status?: string | null; submitted_at?: string | null; call_ended_at?: string | null; category?: string | null }[],
): { attempts: number; lastAttemptAt: string | null; lastCategory: string | null } {
  let lastAt: string | null = lead.last_call_at ?? null;
  let lastCategory: string | null = null;
  let lastReportAt = -Infinity;
  let count = 0;
  for (const r of reports) {
    if (!r.submitted_at) continue;
    count += 1;
    const at = r.call_ended_at ?? r.submitted_at;
    const ms = Date.parse(at);
    if (ms > lastReportAt) {
      lastReportAt = ms;
      lastCategory = r.category ?? null;
    }
    if (!lastAt || ms > Date.parse(lastAt)) lastAt = at;
  }
  return { attempts: Math.max(lead.call_attempts ?? 0, count), lastAttemptAt: lastAt, lastCategory };
}
