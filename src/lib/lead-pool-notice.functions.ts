import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** HQ read-only: open lead-pool shortage / hand-out failure alerts plus the live usable pool size. */
export const getLeadPoolNotice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const access = await import("@/lib/access.server");
    access.requireAuthority(await access.resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { usablePoolCount } = await import("@/lib/lead-pool.server");
    const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const [alerts, pool] = await Promise.all([
      supabaseAdmin.from("system_alerts").select("id, code, title, detail, action, created_at")
        .in("code", ["lead_pool_low", "lead_distribution_failed"]).is("acknowledged_at", null)
        .gte("created_at", since).order("created_at", { ascending: false }).limit(5),
      usablePoolCount(),
    ]);
    if (alerts.error) throw new Error("Lead pool notice unavailable");
    return { alerts: alerts.data ?? [], pool };
  });
