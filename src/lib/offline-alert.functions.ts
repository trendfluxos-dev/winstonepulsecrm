import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { OFFLINE_ALERT_CONFIG_ID, offlineAlertSchema, readOfflineAlertConfig } from "@/lib/offline-alert-config";

const Base = z.object({ adminToken: z.string().nullable().optional() });

/** Any signed-in staff session reads the thresholds (agents need them for alerts). */
export const getOfflineAlertConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("Sign in required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("app_config").select("data").eq("id", OFFLINE_ALERT_CONFIG_ID).maybeSingle();
    return readOfflineAlertConfig(row?.data);
  });

/** IT/coordinator only, never read-only HQ; every change is audited. */
export const saveOfflineAlertConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({ syncingMinutes: z.number(), notSentMinutes: z.number() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireDispatch, requireWrite } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireDispatch(caller);
    requireWrite(caller);
    const next = offlineAlertSchema.parse({ syncingMinutes: data.syncingMinutes, notSentMinutes: data.notSentMinutes });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin.from("app_config").select("data").eq("id", OFFLINE_ALERT_CONFIG_ID).maybeSingle();
    const { error } = await supabaseAdmin
      .from("app_config")
      .upsert({ id: OFFLINE_ALERT_CONFIG_ID, data: next, updated_at: new Date().toISOString() });
    if (error) throw new Error("Could not save alert times");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "offline_alert_config_changed",
      entityType: "app_config",
      entityId: OFFLINE_ALERT_CONFIG_ID,
      metadata: { before: readOfflineAlertConfig(prev?.data), after: next },
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "Authority PIN",
    });
    return next;
  });
