import { summarizeEvidence, type EvidenceReport } from "@/lib/call-evidence";
import { inDhakaRange, uniqueById, followUpKpis, leadKpis, reportKpis, reportLeadReconciliation, type DayRange, type KpiFollowUp, type KpiLead, type KpiReport } from "@/lib/kpi-contract";

/** Pure projection of already-authorized HQ rows; never accepts phone-sync data. Evidence is display-only. */
export function agentKpiRows(
  agents: { id: string; name: string }[], leads: KpiLead[],
  reports: (KpiReport & EvidenceReport & { agent_id: string | null })[],
  followUps: (KpiFollowUp & { agent_id: string | null })[], range: DayRange, now: Date,
) {
  return agents.map((agent) => {
    const owned = leads.filter((l) => (l.assigned_agent_id ?? l.assigned_to) === agent.id);
    const work = reports.filter((r) => r.agent_id === agent.id);
    return { agent, leads: leadKpis(owned, agent.id), reports: reportKpis(work, range),
      evidence: summarizeEvidence(uniqueById(work).filter((r) => inDhakaRange(r.submitted_at, range))),
      breakdown: reportLeadReconciliation(work, range, new Set(owned.map((l) => l.id))),
      followUps: followUpKpis(followUps.filter((f) => f.agent_id === agent.id), now) };
  });
}