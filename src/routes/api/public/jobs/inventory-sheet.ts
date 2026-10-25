import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
export const Route = createFileRoute("/api/public/jobs/inventory-sheet")({ server: { handlers: {
  POST: async ({ request }) => {
    const authFailure = await authenticateCronRequest(request);
    if (authFailure) return authFailure;
    const body = await request.json().catch(() => null);
    if (!body || body.kind !== "hourly" || Object.keys(body).length !== 1) return Response.json({ ok: false, code: "INVALID_BODY" }, { status: 400 });
    const { syncInventorySheet } = await import("@/lib/inventory-sheet.server");
    const { logAudit } = await import("@/lib/audit.server");
    try {
      const state = await syncInventorySheet();
      await logAudit({ action: "inventory_sheet_sync", entityType: "inventory_sheet", actorLabel: "Scheduled inventory sync", metadata: { source: "scheduled", rows: state.rows.length, outcome: "success" } });
      return Response.json({ ok: true, rows: state.rows.length, syncedAt: state.syncedAt }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      await logAudit({ action: "inventory_sheet_sync", entityType: "inventory_sheet", actorLabel: "Scheduled inventory sync", metadata: { source: "scheduled", outcome: "failure" } });
      return Response.json({ ok: false, code: "SYNC_FAILED" }, { status: 502 });
    }
  },
} } });