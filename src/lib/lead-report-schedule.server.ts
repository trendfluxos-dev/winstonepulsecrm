import { z } from "zod";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const LEAD_REPORT_SCHEDULE = {
  name: "winstone-lead-report-after-shift",
  schedule: "35 11 * * *",
  targetPath: "/api/public/jobs/lead-report-sheet",
  body: { kind: "daily" },
} as const;

const Body = z.object({ kind: z.literal("daily") }).strict();

export async function handleLeadReportSchedule(request: Request): Promise<Response> {
  const authFailure = await authenticateCronRequest(request);
  if (authFailure) return authFailure;

  const body = await request.text();
  if (body.length > 1024) return Response.json({ ok: false, code: "BODY_TOO_LARGE" }, { status: 413 });
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch {
    return Response.json({ ok: false, code: "INVALID_BODY" }, { status: 400 });
  }
  if (!Body.safeParse(parsed).success) {
    return Response.json({ ok: false, code: "INVALID_BODY" }, { status: 400 });
  }

  const { logAudit } = await import("@/lib/audit.server");
  try {
    const { syncLeadReportToSheet } = await import("@/lib/lead-report-sheet.server");
    const result = await syncLeadReportToSheet({ preserveExisting: true });
    await logAudit({
      action: "lead_report_sheet_sync", entityType: "leads",
      actorLabel: "Scheduled Daily Lead Report",
      metadata: { source: "scheduled", outcome: "success", tab: result.tab, rows: result.rows },
    });
    return Response.json({ ok: true, tab: result.tab, rows: result.rows, syncedAt: result.syncedAt },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    await logAudit({
      action: "lead_report_sheet_sync", entityType: "leads",
      actorLabel: "Scheduled Daily Lead Report",
      metadata: { source: "scheduled", outcome: "failure", code: "SHEET_SYNC_FAILED" },
    });
    return Response.json({ ok: false, code: "SHEET_SYNC_FAILED" },
      { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}