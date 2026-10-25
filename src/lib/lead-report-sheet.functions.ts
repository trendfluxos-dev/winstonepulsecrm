import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** IT Console: read the Daily Lead Report sync state and push a fresh sync. */
const Input = z.object({ adminToken: z.string().nullable().optional() });

async function requireSupervisor(adminToken: string | null) {
  const { resolveCaller, requireDispatch } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken);
  requireDispatch(caller);
  return caller;
}

export const leadReportSheetStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    await requireSupervisor(data.adminToken ?? null);
    const { readLeadReportSyncState, leadReportSheetUrl } = await import(
      "@/lib/lead-report-sheet.server"
    );
    const sync = await readLeadReportSyncState();
    return { sync, sheetUrl: leadReportSheetUrl() };
  });

export const pushLeadReportSheet = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const caller = await requireSupervisor(data.adminToken ?? null);
    const { syncLeadReportToSheet } = await import("@/lib/lead-report-sheet.server");
    const result = await syncLeadReportToSheet();
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "lead_report_sheet_sync",
      entityType: "leads",
      entityId: null,
      metadata: { tab: result.tab, rows: result.rows },
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "Authority PIN",
    });
    return result;
  });
