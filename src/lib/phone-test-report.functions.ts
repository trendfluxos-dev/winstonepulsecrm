import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PhoneTestReportSchema, failedCount } from "@/lib/phone-test-report";

/** Saves an agent's APK pass/fail report. Touches only phone_test_reports — never leads, calls or scores. */
export const submitPhoneTestReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => PhoneTestReportSchema.parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const me = await resolveCaller(null);
    if (!me.userId || !me.profile || me.scope === "none") throw new Error("Sign in with an approved staff account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("phone_test_reports").insert({
      profile_id: me.profile.id, phone_model: data.phoneModel, app_version: data.appVersion || null,
      results: data.results, failed_count: failedCount(data.results), issue: data.issue || null, sent_to_it: data.sendToIt,
    });
    if (error) throw new Error("Could not save the report; try again");
    return { ok: true };
  });

export const getMyPhoneTestReports = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveCaller } = await import("@/lib/access.server");
  const me = await resolveCaller(null);
  if (!me.userId || !me.profile || me.scope === "none") throw new Error("Sign in with an approved staff account");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("phone_test_reports")
    .select("id, created_at, phone_model, app_version, failed_count, sent_to_it")
    .eq("profile_id", me.profile.id).order("created_at", { ascending: false }).limit(10);
  if (error) throw new Error("Report history unavailable");
  return data ?? [];
});

/** IT inbox: reports agents chose to send to IT. Full IT PIN only. */
export const getItPhoneTestReports = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().min(1).max(4000) }).parse(i))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken) !== "full") throw new Error("Full IT PIN required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("phone_test_reports")
      .select("id, created_at, phone_model, app_version, results, failed_count, issue, profiles(full_name)")
      .eq("sent_to_it", true).order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("IT reports unavailable");
    return (rows ?? []).map((r) => ({
      id: r.id, createdAt: r.created_at, phoneModel: r.phone_model, appVersion: r.app_version,
      results: r.results as Record<string, string>, failedCount: r.failed_count, issue: r.issue,
      agent: (r.profiles as { full_name?: string } | null)?.full_name ?? "—",
    }));
  });
