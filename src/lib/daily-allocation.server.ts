import { dhakaDateOf } from "@/lib/business-day";
import { summarizeDailyAllocation } from "@/lib/daily-allocation";
import { activeAgents } from "@/lib/lead-pool.server";
import { readAllocationReceipts } from "@/lib/allocation-ledger.server";

/** Caller must be verified before entering this read-only helper. */
export async function readDailyAllocation(agentId?: string) {
  const day = dhakaDateOf();
  const agents = (await activeAgents()).filter(agent => !agentId || agent.id === agentId);
  if (agents.length === 0) return summarizeDailyAllocation(day, [], []);
  const receipts = await readAllocationReceipts(day, agents.map(agent => agent.id));
  return summarizeDailyAllocation(day, agents, receipts);
}