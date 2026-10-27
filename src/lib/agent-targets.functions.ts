import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_DAILY_LEADS_PER_AGENT } from "@/lib/lead-quota";

/** Exported for tests: HQ may set 1–50 leads/day per agent (50 stays the hard cap). */
export const SetTargetInput = z.object({
  adminToken: z.string().nullable().optional(),
  agentId: z.string().uuid(),
  target: z.number().int().min(1).max(MAX_DAILY_LEADS_PER_AGENT),
});

/** Genuine HQ PIN only; read-only oversight grants cannot change targets. */
async function hqWriter(adminToken: string | null | undefined) {
  const { resolveCaller, requireAuthority, HQ_READ_ONLY } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken);
  requireAuthority(caller);
  const { adminTokenScope } = await import("@/lib/admin-gate.server");
  if (caller.readOnly && adminTokenScope(adminToken) !== "hq") throw new Error(HQ_READ_ONLY);
  return caller;
}

export const listAgentTargets = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken));
    const { activeAgents, dailyPlan, agentDailyTargets, dhakaToday } = await import("@/lib/lead-pool.server");
    const [agents, plan, targets] = await Promise.all([activeAgents(), dailyPlan(), agentDailyTargets(dhakaToday())]);
    return {
      floorQuota: Math.min(MAX_DAILY_LEADS_PER_AGENT, plan.perAgent),
      max: MAX_DAILY_LEADS_PER_AGENT,
      rows: agents.map((a) => ({ id: a.id, name: a.name, target: targets.get(a.id) ?? null })),
    };
  });

/** Appends a new target row (history is immutable); applies from today's next hand-out. */
export const setAgentTarget = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SetTargetInput.parse(input))
  .handler(async ({ data }) => {
    await hqWriter(data.adminToken);
    const { activeAgents, dhakaToday } = await import("@/lib/lead-pool.server");
    const agents = await activeAgents();
    if (!agents.some((a) => a.id === data.agentId)) throw new Error("Agent is not active");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("agent_daily_target_history").insert({
      agent_id: data.agentId,
      target: data.target,
      effective_day: dhakaToday(),
      actor_label: "Executive HQ",
    });
    if (error) throw new Error("Could not save the target");
    return { ok: true, target: data.target };
  });
