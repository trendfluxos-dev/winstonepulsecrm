import { createFileRoute } from "@tanstack/react-router";
import type { DistributionStage } from "@/lib/distribution-failure";

/**
 * Daily lead hand-out: gives every active agent the configured number of leads
 * from the head database (50 per agent), skipping any number an agent already
 * has. Runs once per Dhaka day — a second call the same day does nothing.
 * Caller must present the cron secret.
 */
export const Route = createFileRoute("/api/public/hooks/lead-distribution")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const header =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: stored } = await supabaseAdmin
          .from("system_settings")
          .select("value")
          .eq("key", "shift_cron_secret")
          .maybeSingle();
        const storedSecret =
          stored && typeof stored.value === "object" && stored.value !== null
            ? (stored.value as { secret?: string }).secret
            : undefined;

        const accepted = [
          process.env["SHIFT_CRON_SECRET"],
          process.env["LOVABLE_CRON_SECRET"],
          storedSecret,
        ].filter((value): value is string => Boolean(value));
        if (accepted.length === 0 || !header || !accepted.includes(header)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let stage: DistributionStage = "prepare";
        try {
          const { distributeDailyLeads, dailyPlan, saveDailyPlan, dhakaToday, usablePoolCount } =
            await import("@/lib/lead-pool.server");
          const today = dhakaToday();
          // Yesterday's (and earlier) unfinished leads move onto today's board
          // first — this runs even on a same-day retry, it only touches the past.
          const { rolloverPendingLeads } = await import("@/lib/lead-pool.server");
          stage = "rollover";
          const rolledOver = await rolloverPendingLeads(today);
          const { isDistributionDay } = await import("@/lib/business-day");
          if (!isDistributionDay(today)) {
            return Response.json({ ok: true, skipped: "friday_no_distribution", today, rolledOver });
          }
          stage = "plan";
          const plan = await dailyPlan();
          if (plan.lastRunDate === today) {
            return Response.json({ ok: true, skipped: "already_done_today", today, rolledOver });
          }

          stage = "pool";
          const before = await usablePoolCount();
          if (before === 0) {
            const { raiseShortageAlert, activeAgents } = await import("@/lib/lead-pool.server");
            const agents = await activeAgents();
            await raiseShortageAlert({
              remaining: 0,
              need: agents.length * plan.perAgent,
              perAgent: plan.perAgent,
            });
            return Response.json({ ok: true, skipped: "database_empty", today });
          }

          stage = "assign";
          const result = await distributeDailyLeads({
            perAgent: plan.perAgent,
            actorLabel: "স্বয়ংক্রিয় দৈনিক বিতরণ",
            trigger: "daily_auto",
          });
          stage = "save_plan";
          await saveDailyPlan({ perAgent: plan.perAgent, lastRunDate: today });
          return Response.json({ ok: true, ...result });
        } catch (error) {
          const { safeDistributionReason } = await import("@/lib/distribution-failure");
          const reason = safeDistributionReason(error);
          let alertSaved = false;
          try {
            const { recordDistributionFailure } = await import("@/lib/distribution-failure.server");
            await recordDistributionFailure(error, stage);
            alertSaved = true;
          } catch { console.error("daily lead distribution alert persistence failed", { reason, stage }); }
          console.error("daily lead distribution failed", { reason, stage, alertSaved });
          return new Response(
            JSON.stringify({ error: "lead_distribution_failed", reason, stage, alertSaved }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
