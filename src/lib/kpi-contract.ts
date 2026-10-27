/**
 * Shared agent KPI contract — the single set of definitions used by My Desk and
 * the agent Analytics charts. Pure functions over rows the server already scoped
 * to the signed-in agent (getCrmSnapshot view "agent", getDeskWork, getDeskReports).
 *
 * Definitions (Asia/Dhaka calendar days, inclusive ranges, every source id-deduped):
 * - owned            leads whose current owner (assigned_agent_id ?? assigned_to) is me, any state
 * - active           owned and work_state not completed / duplicate_skipped
 * - completedOwned   owned with work_state = completed (historical, all time)
 * - closed           owned with status = closed (a sales status, NOT the same as completed work)
 * - hot              active AND temperature = hot (current state, no time window)
 * - daily completion denominator = owned leads with work_date = day; when the
 *   allocation ledger count for that day differs, the result is flagged for reconciliation
 * - follow-ups       current_follow_up_work_items with status upcoming|rescheduled;
 *                    overdue = scheduled_at < now
 * - call attempts    phone-synced call rows started in range (Android sync evidence only)
 * - connected call   phone-synced call with duration > CONNECTED_SECONDS
 * - reports          call_reports with submitted_at in range; reportedConnected = connected = true
 * - WhatsApp         unavailable (null) unless at least one synced message event exists
 */
import { dhakaDay } from "@/lib/lead-groups";

export const CONNECTED_SECONDS = 10;
export type DayRange = { from: string | null; to: string | null };
export type KpiLead = { id: string; status: string; work_state?: string | null; work_date?: string | null; temperature?: string | null; assigned_agent_id?: string | null; assigned_to?: string | null };
export type KpiReport = { id: string; submitted_at: string | null; connected: boolean | null };
export type KpiCall = { id: string; started_at?: string | null; created_at: string; duration_seconds: number | null };
export type KpiFollowUp = { id: string; status: string; scheduled_at: string | null };

export const uniqueById = <T extends { id: string }>(rows: T[]) => [...new Map(rows.map((r) => [r.id, r])).values()];
export const ownerOf = (l: KpiLead) => l.assigned_agent_id ?? l.assigned_to ?? null;

/** Reversed ranges are rejected, never silently swapped or shown as zero. */
export function rangeError(range: DayRange): string | null {
  return range.from && range.to && range.from > range.to ? "Start date must be on or before end date." : null;
}
export function inDhakaRange(iso: string | null | undefined, range: DayRange): boolean {
  if (!iso) return false;
  const d = dhakaDay(iso);
  return (!range.from || d >= range.from) && (!range.to || d <= range.to);
}

export function leadKpis(leads: KpiLead[], me: string) {
  const mine = uniqueById(leads).filter((l) => ownerOf(l) === me);
  const active = mine.filter((l) => l.work_state !== "completed" && l.work_state !== "duplicate_skipped");
  return {
    owned: mine.length,
    active: active.length,
    activePending: active.filter((l) => l.status === "pending").length,
    completedOwned: mine.filter((l) => l.work_state === "completed").length,
    closed: mine.filter((l) => l.status === "closed").length,
    hot: active.filter((l) => l.temperature === "hot").length,
  };
}

export type DailyCompletion =
  | { state: "ok"; assigned: number; completed: number; pct: number }
  | { state: "reconcile"; assigned: number; completed: number; ledger: number };

export function dailyCompletion(leads: KpiLead[], me: string, day: string, ledgerCount: number | null): DailyCompletion {
  const dated = uniqueById(leads).filter((l) => ownerOf(l) === me && l.work_date === day);
  const completed = dated.filter((l) => l.work_state === "completed").length;
  if (ledgerCount != null && ledgerCount !== dated.length) return { state: "reconcile", assigned: dated.length, completed, ledger: ledgerCount };
  return { state: "ok", assigned: dated.length, completed, pct: dated.length ? Math.round((completed / dated.length) * 100) : 0 };
}

export function followUpKpis(items: KpiFollowUp[], now: Date) {
  const open = uniqueById(items).filter((f) => (f.status === "upcoming" || f.status === "rescheduled") && f.scheduled_at);
  const day = dhakaDay(now);
  const t = now.getTime();
  return {
    open: open.length,
    overdue: open.filter((f) => Date.parse(f.scheduled_at!) < t).length,
    dueToday: open.filter((f) => dhakaDay(f.scheduled_at!) === day && Date.parse(f.scheduled_at!) >= t).length,
  };
}

export function reportKpis(reports: KpiReport[], range: DayRange) {
  const rows = uniqueById(reports).filter((r) => inDhakaRange(r.submitted_at, range));
  const reportedConnected = rows.filter((r) => r.connected === true).length;
  return { submitted: rows.length, reportedConnected, rate: rows.length ? Math.round((reportedConnected / rows.length) * 100) : 0 };
}

export function callKpis(calls: KpiCall[], range: DayRange) {
  const rows = uniqueById(calls).filter((c) => inDhakaRange(c.started_at ?? c.created_at, range));
  const connected = rows.filter((c) => (c.duration_seconds ?? 0) > CONNECTED_SECONDS).length;
  return { attempts: rows.length, connected, rate: rows.length ? Math.round((connected / rows.length) * 100) : 0 };
}

/** null = no synced WhatsApp evidence at all, shown as "Unavailable" rather than 0. */
export function whatsappKpi(messages: { id: string; created_at: string }[], range: DayRange): number | null {
  if (messages.length === 0) return null;
  return uniqueById(messages).filter((m) => inDhakaRange(m.created_at, range)).length;
}
