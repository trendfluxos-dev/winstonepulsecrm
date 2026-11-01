import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { SyncFailureRow } from "@/lib/android-sync-failures";

export const SYNC_FAILURES_CAP = 3000;

const Input = z
  .object({
    adminToken: z.string().nullable().optional(),
    fromIso: z.string().datetime(),
    toIso: z.string().datetime(),
  })
  .refine((v) => Date.parse(v.toIso) > Date.parse(v.fromIso), { message: "End must be after start" })
  .refine((v) => Date.parse(v.toIso) - Date.parse(v.fromIso) <= 31 * 86_400_000, { message: "Range is limited to 31 days" });

/**
 * HQ/IT (authority) read-only summary of Android sync failures reported by
 * agent phones. No writes; only the safe DTO fields leave the server.
 */
export const listAndroidSyncFailures = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { SYNC_FAILURE_EVENT, toSyncFailureEvent } = await import("@/lib/android-sync-failures");

    const res = await supabaseAdmin
      .from("sync_events")
      .select("id, agent_id, device_id, created_at, payload")
      .eq("status", "failed")
      .eq("event_type", SYNC_FAILURE_EVENT)
      .gte("created_at", data.fromIso)
      .lt("created_at", data.toIso)
      .order("created_at", { ascending: false })
      .limit(SYNC_FAILURES_CAP);
    if (res.error) throw new Error("Could not read sync failures");
    const rows = (res.data ?? []) as SyncFailureRow[];

    const agentIds = [...new Set(rows.map((r) => r.agent_id).filter((v): v is string => Boolean(v)))];
    const deviceIds = [...new Set(rows.map((r) => r.device_id).filter((v): v is string => Boolean(v)))];
    const [profiles, devices] = await Promise.all([
      agentIds.length
        ? supabaseAdmin.from("profiles").select("id, name").in("id", agentIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
      deviceIds.length
        ? supabaseAdmin.from("agent_devices").select("id, app_version").in("id", deviceIds)
        : Promise.resolve({ data: [] as { id: string; app_version: string | null }[], error: null }),
    ]);
    if (profiles.error || devices.error) throw new Error("Could not read agent names");
    const names = new Map((profiles.data ?? []).map((p) => [p.id, p.name ?? ""]));
    const versions = new Map((devices.data ?? []).map((d) => [d.id, d.app_version ?? ""]));

    return {
      events: rows.map((r) => toSyncFailureEvent(r, names, versions)),
      capped: rows.length >= SYNC_FAILURES_CAP,
      readAtUtc: new Date().toISOString(),
    };
  });
