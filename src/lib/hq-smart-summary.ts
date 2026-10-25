import { computeCommandCenter, type CcAgent, type CcCall, type CcFollowUp, type CcLead, type CcReport } from "@/lib/command-center";
import { dhakaDay } from "@/lib/lead-groups";

type SummaryLead = CcLead & { work_state?: string | null; call_attempts?: number; last_call_at?: string | null };

/** Same submitted-report/recording reconciliation as the command center. */
export function computeHqSmartSummary(input: {
  agents: CcAgent[]; leads: SummaryLead[]; calls: CcCall[];
  reports: CcReport[]; followUps: CcFollowUp[]; now: Date; dailyLeadQuota: number;
}) {
  const day = dhakaDay(input.now);
  const cc = computeCommandCenter({ ...input, filters: { fromDay: day, toDay: day, agentId: null, source: null, project: null } });
  const recordedLeadIds = new Set([...input.calls, ...input.reports].map(r => r.lead_id).filter(Boolean));
  const activeIds = new Set(input.agents.map(a => a.id));
  const pending = input.leads.filter(l => {
    const owner = l.assigned_agent_id ?? l.assigned_to;
    return owner && activeIds.has(owner) && l.status === "pending" && l.work_state !== "completed"
      && !recordedLeadIds.has(l.id) && !(l.call_attempts && l.call_attempts > 0) && !l.last_call_at;
  });
  const medianValues = cc.agentRows.map(a => a.connected).sort((a, b) => a - b);
  const median = medianValues[Math.floor(medianValues.length / 2)] ?? 0;
  return {
    noEvidence: cc.agentRows.filter(a => a.calls === 0),
    behind: cc.agentRows.filter(a => a.calls > 0 && median > 0 && a.connected < median / 2),
    pendingCount: pending.length,
    pendingByAgent: input.agents.map(a => ({ ...a, count: pending.filter(l => (l.assigned_agent_id ?? l.assigned_to) === a.id).length }))
      .filter(a => a.count > 0).sort((a, b) => b.count - a.count),
    connectedToday: cc.kpi.connectedToday,
    bookingsToday: cc.kpi.bookings,
  };
}