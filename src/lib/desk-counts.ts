import { dhakaDay } from "@/lib/lead-groups";

/** Pure My Desk counts over rows the server already scoped to the signed-in agent. */
type Lead = { id: string; status: string; work_state?: string | null; work_date?: string | null; temperature?: string | null; assigned_agent_id?: string | null; assigned_to?: string | null };
type Report = { id: string; submitted_at: string | null; connected: boolean | null };
type FollowUp = { id: string; status: string; scheduled_at: string | null };

const unique = <T extends { id: string }>(rows: T[]) => [...new Map(rows.map(r => [r.id, r])).values()];
const OPEN_FOLLOW_UP = new Set(["upcoming", "rescheduled"]);

/** Active = owned now and not completed/parked-as-duplicate. */
export const isActiveAssigned = (lead: Lead, me: string) =>
  (lead.assigned_agent_id ?? lead.assigned_to) === me && lead.work_state !== "completed" && lead.work_state !== "duplicate_skipped";

/** One hot rule for every desk tile and filter. */
export const isHotActive = (lead: Lead, me: string) => isActiveAssigned(lead, me) && lead.temperature === "hot";

export function deskLeadCounts(leads: Lead[], me: string, range: { from: string; to: string }) {
  const mine = unique(leads).filter(l => (l.assigned_agent_id ?? l.assigned_to) === me);
  const active = mine.filter(l => isActiveAssigned(l, me));
  const inRange = mine.filter(l => l.work_date && l.work_date >= range.from && l.work_date <= range.to);
  return {
    allTimeOwned: mine.length,
    active: active.length,
    activePending: active.filter(l => l.status === "pending").length,
    hot: active.filter(l => l.temperature === "hot").length,
    rangeAssigned: inRange.length,
    rangeCompleted: inRange.filter(l => l.work_state === "completed").length,
  };
}

export function deskReportCounts(reports: Report[], day: string) {
  const today = unique(reports).filter(r => r.submitted_at && dhakaDay(r.submitted_at) === day);
  return { submitted: today.length, reportedConnected: today.filter(r => r.connected === true).length };
}

export function deskFollowUpCounts(items: FollowUp[], now: Date) {
  const open = unique(items).filter(f => OPEN_FOLLOW_UP.has(f.status) && f.scheduled_at);
  const day = dhakaDay(now);
  return {
    open: open.length,
    overdue: open.filter(f => Date.parse(f.scheduled_at!) < now.getTime()).length,
    dueToday: open.filter(f => dhakaDay(f.scheduled_at!) === day && Date.parse(f.scheduled_at!) >= now.getTime()).length,
  };
}
