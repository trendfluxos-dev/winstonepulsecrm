import type { AllocationReceipt } from "@/lib/daily-allocation";

/** One paginated, fail-closed receipt reader for UI totals and distribution capacity. */
export async function readAllocationReceipts(day: string, agentIds?: string[]): Promise<AllocationReceipt[]> {
  if (agentIds?.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const receipts: AllocationReceipt[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabaseAdmin.from("lead_daily_assignment_ledger")
      .select("agent_id, lead_id, work_date").eq("work_date", day);
    if (agentIds) query = query.in("agent_id", agentIds);
    const result = await query.order("agent_id").order("lead_id").range(offset, offset + 999);
    if (result.error) throw new Error("আজকের নতুন লিড বণ্টনের তথ্য আনা যায়নি / Daily allocation unavailable");
    receipts.push(...(result.data ?? []));
    if ((result.data ?? []).length < 1000) return receipts;
  }
}