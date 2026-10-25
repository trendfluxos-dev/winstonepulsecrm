import { dhakaDateOf } from "@/lib/business-day";
import { summarizeDailyAllocation } from "@/lib/daily-allocation";
import { activeAgents } from "@/lib/lead-pool.server";
import { readAllocationReceipts } from "@/lib/allocation-ledger.server";
import { parseAgentTargets } from "@/lib/agent-targets";

export const AGENT_TARGETS_CONFIG_ID = "agent_daily_targets";

export async function readAgentTargets(): Promise<Record<string, number>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("app_config").select("data").eq("id", AGENT_TARGETS_CONFIG_ID).maybeSingle();
  if (error) throw new Error("Targets unavailable");
  return parseAgentTargets(data?.data);
}

/** Caller must be verified before entering this read-only helper. */
export async function readDailyAllocation(agentId?: string) {
  const day = dhakaDateOf();
  const agents = (await activeAgents()).filter(agent => !agentId || agent.id === agentId);
  if (agents.length === 0) return summarizeDailyAllocation(day, [], []);
  const [receipts, targets] = await Promise.all([readAllocationReceipts(day, agents.map(agent => agent.id)), readAgentTargets()]);
  return summarizeDailyAllocation(day, agents, receipts, targets);
}
