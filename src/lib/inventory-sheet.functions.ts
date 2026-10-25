import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const Base = z.object({ adminToken: z.string().nullable().optional() });

export const inventorySheetStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const caller = await siCaller(data.adminToken);
    const { readInventorySheetState } = await import("@/lib/inventory-sheet.server");
    return { state: await readInventorySheetState(), canManage: caller.scope === "authority" && !caller.readOnly };
  });

export const saveInventorySheetSource = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.extend({ link: z.string().max(400), tab: z.string().trim().min(1).max(100).regex(/^[\p{L}\p{N} _.-]+$/u) }).parse(i))
  .handler(async ({ data }) => {
    const { siCaller, requireAdminWriter } = await import("@/lib/sales-intel.server");
    const caller = await siCaller(data.adminToken);
    requireAdminWriter(caller);
    const { configureInventorySheet } = await import("@/lib/inventory-sheet.server");
    const state = await configureInventorySheet(data.link, data.tab);
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: "inventory_sheet_sync", entityType: "inventory_sheet", actorProfileId: caller.agentId, actorLabel: caller.actor,
      metadata: { source: "configuration", rows: state.rows.length, syncedAt: state.syncedAt } });
    return { ok: true };
  });

export const refreshInventorySheet = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller, requireAdminWriter } = await import("@/lib/sales-intel.server");
    const caller = await siCaller(data.adminToken);
    requireAdminWriter(caller);
    const { syncInventorySheet } = await import("@/lib/inventory-sheet.server");
    const state = await syncInventorySheet();
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: "inventory_sheet_sync", entityType: "inventory_sheet", actorProfileId: caller.agentId, actorLabel: caller.actor,
      metadata: { source: "manual", rows: state.rows.length, syncedAt: state.syncedAt } });
    return { ok: true };
  });