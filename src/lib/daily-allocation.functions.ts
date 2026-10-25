import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_DAILY_LEADS_PER_AGENT } from "@/lib/lead-quota";

export const getDailyAllocation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    surface: z.enum(["hq", "leadhub", "self"]),
    adminToken: z.string().nullable().optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const access = await import("@/lib/access.server");
    let agentId: string | undefined;
    if (data.surface === "leadhub") {
      await access.requireLeadHub(data.adminToken);
    } else if (data.surface === "hq") {
      access.requireAuthority(await access.resolveCaller(data.adminToken ?? null));
    } else {
      // PINs never choose or impersonate the agent whose own history is read.
      const caller = await access.resolveWorkCaller(null);
      if (caller.scope !== "agent" || !caller.profile) throw new Error("Agent access required");
      agentId = caller.profile.id;
    }
    const { readDailyAllocation } = await import("@/lib/daily-allocation.server");
    return readDailyAllocation(agentId);
  });

/** HQ authority sets one agent's daily target (1..50). The 50 hard cap is unchanged. */
export const setAgentDailyTarget = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    adminToken: z.string().nullable().optional(),
    agentId: z.string().uuid(),
    target: z.number().int().min(1).max(MAX_DAILY_LEADS_PER_AGENT),
  }).parse(input))
  .handler(async ({ data }) => {
    const access = await import("@/lib/access.server");
    const caller = await access.resolveCaller(data.adminToken ?? null);
    access.requireAuthority(caller);
    const { activeAgents } = await import("@/lib/lead-pool.server");
    if (!(await activeAgents()).some(a => a.id === data.agentId)) throw new Error("Active agent not found");
    const { readAgentTargets, AGENT_TARGETS_CONFIG_ID } = await import("@/lib/daily-allocation.server");
    const targets = await readAgentTargets();
    const previous = targets[data.agentId] ?? MAX_DAILY_LEADS_PER_AGENT;
    targets[data.agentId] = data.target;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("app_config").upsert({ id: AGENT_TARGETS_CONFIG_ID, data: { targets }, updated_at: new Date().toISOString() });
    if (error) throw new Error("Target could not be saved");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: "agent_daily_target_set", entityType: "profiles", entityId: data.agentId,
      metadata: { previous, target: data.target }, actorProfileId: caller.profile?.id ?? null, actorLabel: caller.profile?.name ?? "Authority PIN" });
    return { agentId: data.agentId, target: data.target };
  });
