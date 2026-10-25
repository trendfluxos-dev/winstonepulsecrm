import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Latest append-only target effective on the requested day; no historical overwrite. */
export async function readAgentDailyTargets(day: string, agentIds: string[]) {
  const targets = new Map<string, number>();
  if (!agentIds.length) return targets;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("agent_daily_target_history")
      .select("agent_id,target,effective_day,created_at,id").in("agent_id", agentIds).lte("effective_day", day)
      .order("effective_day", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + 999);
    if (error) throw new Error("Daily targets unavailable");
    for (const row of data ?? []) if (!targets.has(row.agent_id)) targets.set(row.agent_id, row.target);
    if (!data || data.length < 1000) return targets;
  }
}