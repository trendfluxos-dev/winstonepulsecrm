import { createServerFn } from "@tanstack/react-start";
import { DeviceCallTestSchema } from "@/lib/device-call-test";

/** Saves a manual phone test result. Touches only device_call_tests — never leads, calls or reports. */
export const submitDeviceCallTest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => DeviceCallTestSchema.parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const me = await resolveCaller(null);
    if (!me.userId || !me.profile || me.scope === "none") throw new Error("Sign in with an approved staff account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("device_call_tests").insert({
      profile_id: me.profile.id, phone_model: data.phoneModel, android_version: data.androidVersion, app_version: data.appVersion || null,
      perm_phone: data.permPhone, perm_call_log: data.permCallLog, perm_microphone: data.permMicrophone, perm_notifications: data.permNotifications,
      network: data.network, call_type: data.callType, call_detected: data.callDetected, recording: data.recording, summary: data.summary, notes: data.notes || null,
    });
    if (error) throw new Error("Could not save the test result; try again");
    return { ok: true };
  });

export const getMyDeviceCallTests = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveCaller } = await import("@/lib/access.server");
  const me = await resolveCaller(null);
  if (!me.userId || !me.profile || me.scope === "none") throw new Error("Sign in with an approved staff account");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("device_call_tests")
    .select("id, created_at, phone_model, android_version, network, call_type, call_detected, recording, summary")
    .eq("profile_id", me.profile.id).order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error("Test history unavailable");
  return data ?? [];
});
