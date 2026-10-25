import { isDistributionDay } from "@/lib/business-day";
import { MAX_DAILY_LEADS_PER_AGENT } from "@/lib/lead-quota";
import { allocationProgress, validDailyTarget } from "@/lib/agent-daily-target";

export type AllocationAgent = { id: string; name: string };
export type AllocationReceipt = { agent_id: string; lead_id: string; work_date: string };

/** New assignments only: rollover and later lead state/ownership cannot change history. */
export function summarizeDailyAllocation(day: string, agents: AllocationAgent[], receipts: AllocationReceipt[], targets = new Map<string, number>()) {
  const unique = new Map(agents.map(agent => [agent.id, new Set<string>()]));
  for (const receipt of receipts) {
    if (receipt.work_date === day) unique.get(receipt.agent_id)?.add(receipt.lead_id);
  }
  const distributionOpen = isDistributionDay(day);
  const rows = agents.map(agent => {
    const received = unique.get(agent.id)?.size ?? 0;
    const target = targets.get(agent.id) ?? MAX_DAILY_LEADS_PER_AGENT;
    if (!validDailyTarget(target)) throw new Error("Invalid daily target");
    return { ...agent, target, progress: allocationProgress(received, target), received, remaining: distributionOpen ? Math.max(0, target - received) : 0,
      zeroAlert: distributionOpen && received === 0 };
  });
  return {
    day, distributionOpen, quota: MAX_DAILY_LEADS_PER_AGENT, agents: rows,
    total: rows.reduce((sum, row) => sum + row.received, 0),
    zeroCount: rows.filter(row => row.received === 0).length,
    completeCount: rows.filter(row => row.received >= row.target).length,
    remaining: distributionOpen ? rows.reduce((sum, row) => sum + row.remaining, 0) : 0,
    showZeroAlert: distributionOpen && rows.some(row => row.received === 0),
  };
}

export type DailyAllocationSummary = ReturnType<typeof summarizeDailyAllocation>;