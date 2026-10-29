import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { recordingEvidence, summaryEvidence } from "@/lib/call-diagnostics";
export const getMyCallDiagnostics = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveCaller } = await import("@/lib/access.server");
  const me = await resolveCaller(null);
  const profile = me.profile;
  if (!me.userId || !profile || me.scope === "none") throw new Error("Sign in with an approved staff account");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [devices, recordings] = await Promise.all([
    db.from("agent_devices").select("id, platform, app_version, last_seen_at, recording_capable, recording_tested, recording_checked_at, recording_mode")
      .eq("profile_id", profile.id).is("revoked_at", null).order("last_seen_at", { ascending: false }).limit(10),
    db.from("call_recordings").select("id, lead_id, created_at, storage_path, upload_status, file_size_bytes, analysis_status, ai_summary")
      .eq("agent_id", profile.id).order("created_at", { ascending: false }).limit(30),
  ]);
  if (devices.error || recordings.error) throw new Error("Call diagnostics unavailable; try again later");
  const { assignedLeadIds } = await import("@/lib/assigned-lead-scope.server");
  const assigned = await assignedLeadIds(profile.id);
  return { checkedAt: new Date().toISOString(), callLogAccess: "unknown" as const,
    devices: devices.data ?? [],
    recordings: (recordings.data ?? []).filter(row => !row.lead_id || assigned.has(row.lead_id)).map(row => ({
      id: row.id, createdAt: row.created_at, recording: recordingEvidence(row), summary: summaryEvidence(row),
    })),
  };
});
/** HQ/IT only: fleet compatibility by phone model + Android version, last 30 days, aggregates only. */
export const getDeviceCompatibilityReport = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const LIMIT = 5000;
    const [devices, calls] = await Promise.all([
      db.from("agent_devices").select("id, manufacturer, model, android_version, recording_capable, recording_tested").eq("platform", "android").limit(LIMIT),
      db.from("call_recordings").select("device_id, storage_path, upload_status, file_size_bytes, analysis_status, ai_summary").not("device_id", "is", null).gte("created_at", since).limit(LIMIT),
    ]);
    if (devices.error || calls.error) throw new Error("Compatibility report unavailable; try again later");
    const { buildCompatibilityReport } = await import("@/lib/call-diagnostics");
    return { checkedAt: new Date().toISOString(), since, truncated: (calls.data?.length ?? 0) >= LIMIT || (devices.data?.length ?? 0) >= LIMIT,
      rows: buildCompatibilityReport(devices.data ?? [], calls.data ?? []) };
  });
