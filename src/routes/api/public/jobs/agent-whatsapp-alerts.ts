import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const Body = z.object({ kind: z.enum(["new_leads", "daily_progress", "hq_daily_report"]) }).strict();

/** Managed-cron callback: count-only WhatsApp alerts to opted-in agents. */
export const Route = createFileRoute("/api/public/jobs/agent-whatsapp-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const raw = await request.text();
        if (raw.length > 512) return Response.json({ ok: false, code: "BODY_TOO_LARGE" }, { status: 413 });
        let parsed: z.infer<typeof Body>;
        try { parsed = Body.parse(JSON.parse(raw)); } catch {
          return Response.json({ ok: false, code: "INVALID_BODY" }, { status: 400 });
        }
        const jobs = await import("@/lib/agent-whatsapp.server");
        try {
          await jobs.processPendingEvents(25);
          const result = parsed.kind === "new_leads" ? await jobs.runNewLeadAlerts()
            : parsed.kind === "daily_progress" ? await jobs.runDailyProgress()
            : await (await import("@/lib/hq-daily-report.server")).runHqDailyReport();
          return Response.json({ ok: true, kind: parsed.kind, ...result }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          const { logAudit } = await import("@/lib/audit.server");
          await logAudit({ action: "agent_whatsapp_alerts_job", entityType: "agent_whatsapp_alerts", actorLabel: "Scheduled WhatsApp alerts", metadata: { kind: parsed.kind, outcome: "failure" } });
          return Response.json({ ok: false, code: "ALERT_JOB_FAILED" }, { status: 502 });
        }
      },
    },
  },
});
