import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const Token = z.object({ adminToken: z.string().max(256).nullable() }).strict();

export const listAgentDailyTargets = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Token.parse(i))
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { readDailyAllocation } = await import("@/lib/daily-allocation.server");
    return readDailyAllocation();
  });

export const saveAgentDailyTarget = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Token.extend({ agentId: z.string().uuid(), target: z.number().int().min(1).max(50) }).parse(i))
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { validDailyTarget } = await import("@/lib/agent-daily-target");
    if (!validDailyTarget(data.target)) throw new Error("Daily target must be 1–50");
    const { activeAgents } = await import("@/lib/lead-pool.server");
    if (!(await activeAgents()).some(a => a.id === data.agentId)) throw new Error("Active agent required");
    const { dhakaDateOf } = await import("@/lib/business-day");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("agent_daily_target_history").insert({ agent_id: data.agentId, target: data.target, effective_day: dhakaDateOf(), actor_label: "IT Console" });
    if (error) throw new Error("Target could not be saved");
    return { ok: true };
  });