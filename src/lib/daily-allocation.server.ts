import { dhakaDateOf } from "@/lib/business-day";
import { summarizeDailyAllocation, type AllocationReceipt } from "@/lib/daily-allocation";
import { activeAgents } from "@/lib/lead-pool.server";

/** Caller must be verified before entering this read-only helper. */
export async function readDailyAllocation(agentId?: string) {
  const day = dhakaDateOf();
  const agents = (await activeAgents()).filter(agent => !agentId || agent.id === agentId);
  if (agents.length === 0) return summarizeDailyAllocation(day, [], []);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const receipts: AllocationReceipt[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabaseAdmin.from("lead_daily_assignment_ledger")
      .select("agent_id, lead_id, work_date").eq("work_date", day)
      .in("agent_id", agents.map(agent => agent.id))
      .order("agent_id").order("lead_id").range(offset, offset + 999);
    if (result.error) throw new Error("আজকের নতুন লিড বণ্টনের তথ্য আনা যায়নি / Daily allocation unavailable");
    receipts.push(...(result.data ?? []));
    if ((result.data ?? []).length < 1000) break;
  }
  return summarizeDailyAllocation(day, agents, receipts);
}