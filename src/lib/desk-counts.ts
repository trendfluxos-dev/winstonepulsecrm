/** My Desk counts — thin wrappers over the shared KPI contract (src/lib/kpi-contract.ts). */
import { followUpKpis, leadKpis, ownerOf, reportKpis, uniqueById, type KpiFollowUp, type KpiLead, type KpiReport } from "@/lib/kpi-contract";

/** Active = owned now and not completed/parked-as-duplicate. */
export const isActiveAssigned = (lead: KpiLead, me: string) =>
  ownerOf(lead) === me && lead.work_state !== "completed" && lead.work_state !== "duplicate_skipped";

/** One hot rule for every desk tile and filter. */
export const isHotActive = (lead: KpiLead, me: string) => isActiveAssigned(lead, me) && lead.temperature === "hot";

export function deskLeadCounts(leads: KpiLead[], me: string, range: { from: string; to: string }) {
  const k = leadKpis(leads, me);
  const inRange = uniqueById(leads).filter((l) => ownerOf(l) === me && l.work_date && l.work_date >= range.from && l.work_date <= range.to);
  return {
    allTimeOwned: k.owned,
    active: k.active,
    activePending: k.activePending,
    hot: k.hot,
    rangeAssigned: inRange.length,
    rangeCompleted: inRange.filter((l) => l.work_state === "completed").length,
  };
}

export function deskReportCounts(reports: KpiReport[], day: string) {
  const r = reportKpis(reports, { from: day, to: day });
  return { submitted: r.submitted, reportedConnected: r.reportedConnected };
}

export function deskFollowUpCounts(items: KpiFollowUp[], now: Date) {
  return followUpKpis(items, now);
}
