import { dhakaDateOf } from "@/lib/business-day";
import { summarizeDailyAllocation } from "@/lib/daily-allocation";
import { activeAgents } from "@/lib/lead-pool.server";
import { readAllocationReceipts } from "@/lib/allocation-ledger.server";
import { readAgentDailyTargets } from "@/lib/agent-daily-target.server";

/** Caller must be verified before entering this read-only helper. */
export async function readDailyAllocation(agentId?: string) {
  const day = dhakaDateOf();
  const agents = (await activeAgents()).filter(agent => !agentId || agent.id === agentId);
  if (agents.length === 0) return summarizeDailyAllocation(day, [], []);
  const ids = agents.map(agent => agent.id);
  const [receipts, targets] = await Promise.all([readAllocationReceipts(day, ids), readAgentDailyTargets(day, ids)]);
  return summarizeDailyAllocation(day, agents, receipts, targets);
}