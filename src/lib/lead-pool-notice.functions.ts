import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** HQ read-only: open lead-pool shortage / hand-out failure alerts plus the live usable pool size. */
export const getLeadPoolNotice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const access = await import("@/lib/access.server");
    access.requireAuthority(await access.resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { usablePoolCount, activeAgents, dailyPlan, agentDailyTargets, dhakaToday } = await import("@/lib/lead-pool.server");
    const { leadPoolCoverage } = await import("@/lib/lead-pool-coverage");
    const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const workDate = dhakaToday();
    const [alerts, pool, agents, plan, targets, holidayRow] = await Promise.all([
      supabaseAdmin.from("system_alerts").select("id, code, title, detail, action, created_at")
        .in("code", ["lead_pool_low", "lead_distribution_failed"]).is("acknowledged_at", null)
        .gte("created_at", since).order("created_at", { ascending: false }).limit(5),
      usablePoolCount(),
      activeAgents(),
      dailyPlan(),
      agentDailyTargets(workDate),
      supabaseAdmin.from("app_config").select("data").eq("id", "office_holidays").maybeSingle(),
    ]);
    if (alerts.error || holidayRow.error) throw new Error("Lead pool notice unavailable");
    const dates = (holidayRow.data?.data as { dates?: unknown } | null)?.dates;
    const holidays = Array.isArray(dates) ? dates.filter((d): d is string => typeof d === "string") : [];
    const coverage = leadPoolCoverage(agents, targets, plan.perAgent, workDate, pool, holidays);
    return { alerts: alerts.data ?? [], pool, ...coverage, agents: agents.length, workDate };
  });
