import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function agentCaller() {
  const { resolveWorkCaller } = await import("@/lib/access.server");
  const caller = await resolveWorkCaller(null);
  if (caller.scope !== "agent" || !caller.profile) throw new Error("Agent access required");
  return caller.profile;
}

/** Signed-in agent's own WhatsApp alert opt-in and their last few alert statuses. */
export const getMyWhatsAppAlerts = createServerFn({ method: "POST" }).handler(async () => {
  const me = await agentCaller();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { normalizeAgentWhatsApp } = await import("@/lib/agent-whatsapp");
  const { alertsEnabled } = await import("@/lib/agent-whatsapp.server");
  const [optin, recent, profile, enabled] = await Promise.all([
    supabaseAdmin.from("agent_whatsapp_optins").select("whatsapp_number, opted_in, opted_out_at, opt_out_source").eq("agent_id", me.id).maybeSingle(),
    supabaseAdmin.from("agent_whatsapp_alerts").select("id, kind, status, created_at, error_detail")
      .eq("agent_id", me.id).order("created_at", { ascending: false }).limit(5),
    supabaseAdmin.from("profiles").select("phone").eq("id", me.id).maybeSingle(),
    alertsEnabled(),
  ]);
  if (optin.error || recent.error) throw new Error("WhatsApp alert settings unavailable");
  return {
    enabled,
    optedIn: optin.data?.opted_in ?? false,
    number: optin.data?.whatsapp_number ?? normalizeAgentWhatsApp(profile.data?.phone) ?? null,
    optedOutByReply: optin.data?.opt_out_source === "whatsapp_reply" && !optin.data?.opted_in,
    recent: (recent.data ?? []).map((r) => ({ id: r.id, kind: r.kind, status: r.status, at: r.created_at, failed: r.status === "failed" })),
  };
});

export const setMyWhatsAppAlerts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ number: z.string().min(10).max(20), optedIn: z.boolean() }).strict().parse(input))
  .handler(async ({ data }) => {
    const me = await agentCaller();
    const { normalizeAgentWhatsApp } = await import("@/lib/agent-whatsapp");
    const number = normalizeAgentWhatsApp(data.number);
    if (!number) throw new Error("সঠিক বাংলাদেশি মোবাইল নম্বর দিন / Enter a valid Bangladesh mobile number");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("agent_whatsapp_optins").upsert({
      agent_id: me.id, whatsapp_number: number, opted_in: data.optedIn, updated_at: now,
      ...(data.optedIn ? { opted_in_at: now, opt_out_source: null } : { opted_out_at: now, opt_out_source: "crm" }),
    }, { onConflict: "agent_id" });
    if (error) throw new Error("Could not save your WhatsApp alert choice");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: data.optedIn ? "agent_whatsapp_opt_in" : "agent_whatsapp_opt_out", entityType: "profiles", entityId: me.id, actorLabel: me.name, metadata: {} });
    return { ok: true, number, optedIn: data.optedIn };
  });

/** Sends the signed-in agent one test message (their own counts), at most once per Dhaka day. */
export const sendMyWhatsAppTest = createServerFn({ method: "POST" }).handler(async () => {
  const me = await agentCaller();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("agent_whatsapp_optins").select("whatsapp_number, opted_in").eq("agent_id", me.id).maybeSingle();
  if (error) throw new Error("WhatsApp alert settings unavailable");
  if (!data?.opted_in) throw new Error("আগে WhatsApp alert চালু করুন / Turn on WhatsApp alerts first");
  const { sendSelfTest } = await import("@/lib/agent-whatsapp.server");
  const outcome = await sendSelfTest(me.id, me.name, data.whatsapp_number);
  return { outcome };
});

const tokenInput = z.object({ adminToken: z.string().max(256).nullable() }).strict();

async function requireFullIt(token: string | null) {
  const { adminTokenScope } = await import("@/lib/admin-gate.server");
  if (adminTokenScope(token) !== "full") throw new Error("Full IT PIN required");
}

/** IT overview: master switch, Meta template review state and aggregate alert counts (no numbers, no names). */
export const getAgentWhatsAppAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ data }) => {
    await requireFullIt(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { alertsEnabled, readTemplateStatuses } = await import("@/lib/agent-whatsapp.server");
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [enabled, templates, optins, alerts] = await Promise.all([
      alertsEnabled(),
      readTemplateStatuses().catch(() => null),
      supabaseAdmin.from("agent_whatsapp_optins").select("agent_id", { count: "exact", head: true }).eq("opted_in", true),
      supabaseAdmin.from("agent_whatsapp_alerts").select("status").gte("created_at", since).limit(5000),
    ]);
    if (optins.error || alerts.error) throw new Error("Alert overview unavailable");
    const byStatus: Record<string, number> = {};
    for (const row of alerts.data ?? []) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    return { enabled, templates, optedIn: optins.count ?? 0, last7Days: byStatus };
  });

export const setAgentWhatsAppEnabled = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenInput.extend({ enabled: z.boolean() }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireFullIt(data.adminToken);
    const { setAlertsEnabled } = await import("@/lib/agent-whatsapp.server");
    await setAlertsEnabled(data.enabled);
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: data.enabled ? "agent_whatsapp_alerts_on" : "agent_whatsapp_alerts_off", entityType: "system_settings", actorLabel: "IT Console", metadata: {} });
    return { enabled: data.enabled };
  });
