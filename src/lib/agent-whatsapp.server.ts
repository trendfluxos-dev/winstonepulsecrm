/**
 * Agent WhatsApp alerts through the WhatsApp Business connector (server only).
 *
 * - Template-only, counts-only messages to the agent's own opted-in number.
 * - One alert row per dedupe key, written before the send, so a retried or
 *   overlapping job can never send the same alert twice.
 * - Delivery state comes only from signed callbacks stored in whatsapp_webhook_events.
 */
import {
  AGENT_WA_HQ_NUMBER_KEY, AGENT_WA_LANGUAGE, AGENT_WA_SETTING_KEY, hqReportDedupeKey, hqReportParams, AGENT_WA_TEMPLATES, dailyProgressParams,
  inNewLeadWindow, isOptOutText, newLeadsParams, newLeadsSinceLastAlert, nextAlertStatus,
  normalizeAgentWhatsApp, type AgentAlertKind, type AgentAlertStatus,
} from "@/lib/agent-whatsapp";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/whatsapp";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function credentials() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const connection = process.env["WHATSAPP_API_KEY"];
  if (!lovable || !connection) throw new Error("WhatsApp connection is not configured");
  return { lovable, connection };
}

async function gateway(path: string, init: RequestInit = {}) {
  const { lovable, connection } = credentials();
  return fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": connection,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function alertsEnabled(): Promise<boolean> {
  const db = await admin();
  const { data, error } = await db.from("system_settings").select("value").eq("key", AGENT_WA_SETTING_KEY).maybeSingle();
  if (error) throw new Error("Alert setting unavailable");
  return data?.value === true;
}

export async function setAlertsEnabled(enabled: boolean) {
  const db = await admin();
  const { error } = await db.from("system_settings")
    .upsert({ key: AGENT_WA_SETTING_KEY, value: enabled, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error("Could not save the alert setting");
}

/** Bounded read of the two alert templates' Meta review status. */
export async function readTemplateStatuses(): Promise<Array<{ name: string; status: string }>> {
  const response = await gateway(`/message_templates?fields=name,status,language&limit=50`, { method: "GET" });
  const text = await response.text();
  if (!response.ok) throw new Error(`WhatsApp template check failed [${response.status}]`);
  const rows = (JSON.parse(text).data ?? []) as Array<{ name: string; status: string; language: string }>;
  const wanted = Object.values(AGENT_WA_TEMPLATES) as string[];
  return wanted.map((name) => ({
    name,
    status: rows.find((row) => row.name === name && row.language === AGENT_WA_LANGUAGE)?.status ?? "MISSING",
  }));
}

/** Reserve → send → record. Returns "duplicate" when this alert was already reserved. */
async function sendAlert(input: {
  agentId: string; to: string; kind: AgentAlertKind; workDate: string; dedupeKey: string;
  template: string; params: string[]; counts: Record<string, number | string>;
}): Promise<"sent" | "failed" | "duplicate"> {
  const db = await admin();
  const reserve = await db.from("agent_whatsapp_alerts").insert({
    agent_id: input.agentId, kind: input.kind, work_date: input.workDate, dedupe_key: input.dedupeKey,
    template: input.template, counts: input.counts, status: "sending",
  }).select("id").single();
  if (reserve.error) {
    if (reserve.error.code === "23505") return "duplicate";
    throw new Error("Could not reserve the WhatsApp alert");
  }
  const id = reserve.data.id;

  let providerId: string | null = null;
  let errorDetail: string | null = null;
  try {
    const response = await gateway("/messages", {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp", to: input.to, type: "template",
        template: {
          name: input.template, language: { code: AGENT_WA_LANGUAGE },
          components: [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    const body = await response.text();
    if (response.ok) providerId = (JSON.parse(body).messages?.[0]?.id as string | undefined) ?? null;
    else errorDetail = `[${response.status}] ${body.slice(0, 500)}`;
    if (response.ok && !providerId) errorDetail = "Meta accepted the request without a message id";
  } catch (error) {
    errorDetail = error instanceof Error ? error.message.slice(0, 300) : "send failed";
  }

  const now = new Date().toISOString();
  const update = providerId
    ? { status: "accepted" as const, provider_message_id: providerId, updated_at: now }
    : { status: "failed" as const, error_detail: errorDetail, failed_at: now, updated_at: now };
  const saved = await db.from("agent_whatsapp_alerts").update(update).eq("id", id);
  if (saved.error) throw new Error("WhatsApp alert sent but its record could not be saved");
  if (providerId) await reconcileStoredStatuses(providerId);
  return providerId ? "sent" : "failed";
}

type Recipient = { agentId: string; name: string; to: string };

async function optedInRecipients(): Promise<Recipient[]> {
  const db = await admin();
  const { activeAgents } = await import("@/lib/lead-pool.server");
  const agents = await activeAgents();
  if (agents.length === 0) return [];
  const { data, error } = await db.from("agent_whatsapp_optins")
    .select("agent_id, whatsapp_number").eq("opted_in", true).in("agent_id", agents.map((a) => a.id));
  if (error) throw new Error("Opt-in list unavailable");
  const names = new Map(agents.map((a) => [a.id, a.name]));
  return (data ?? []).flatMap((row) => {
    const to = normalizeAgentWhatsApp(row.whatsapp_number);
    return to ? [{ agentId: row.agent_id, name: names.get(row.agent_id) ?? "", to }] : [];
  });
}

async function receivedToday(day: string, agentIds: string[]): Promise<Map<string, number>> {
  const { readAllocationReceipts } = await import("@/lib/allocation-ledger.server");
  const receipts = await readAllocationReceipts(day, agentIds);
  const sets = new Map<string, Set<string>>();
  for (const r of receipts) (sets.get(r.agent_id) ?? sets.set(r.agent_id, new Set()).get(r.agent_id)!).add(r.lead_id);
  return new Map([...sets].map(([id, s]) => [id, s.size]));
}

export async function runNewLeadAlerts(now = new Date()) {
  const { dhakaDateOf, isDistributionDay } = await import("@/lib/business-day");
  const day = dhakaDateOf(now.getTime());
  if (!(await alertsEnabled())) return { skipped: "disabled" as const };
  if (!isDistributionDay(day) || !inNewLeadWindow(now)) return { skipped: "closed" as const };
  const recipients = await optedInRecipients();
  if (recipients.length === 0) return { sent: 0, failed: 0 };
  const totals = await receivedToday(day, recipients.map((r) => r.agentId));
  const db = await admin();
  const prior = await db.from("agent_whatsapp_alerts").select("agent_id, counts")
    .eq("work_date", day).eq("kind", "new_leads").in("agent_id", recipients.map((r) => r.agentId));
  if (prior.error) throw new Error("Earlier alerts unavailable");
  const lastTotal = new Map<string, number>();
  for (const row of prior.data ?? []) {
    const total = Number((row.counts as Record<string, unknown>)?.["total"] ?? 0);
    lastTotal.set(row.agent_id, Math.max(lastTotal.get(row.agent_id) ?? 0, total));
  }
  let sent = 0, failed = 0;
  for (const r of recipients) {
    const total = totals.get(r.agentId) ?? 0;
    const fresh = newLeadsSinceLastAlert(total, lastTotal.get(r.agentId) ?? 0) ?? 0;
    if (fresh <= 0) continue;
    const outcome = await sendAlert({
      agentId: r.agentId, to: r.to, kind: "new_leads", workDate: day,
      dedupeKey: `new_leads:${r.agentId}:${day}:${total}`, template: AGENT_WA_TEMPLATES.newLeads,
      params: newLeadsParams(r.name, fresh), counts: { total, fresh },
    });
    if (outcome === "sent") sent++; else if (outcome === "failed") failed++;
  }
  return { sent, failed };
}

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

async function progressCounts(day: string, agentIds: string[]) {
  const db = await admin();
  const { dhakaDayBounds } = await import("@/lib/accountability");
  const { followUpWork } = await import("@/lib/follow-up-work.server");
  const { pageAllParallel } = await import("@/lib/page-all");
  const { start, end } = dhakaDayBounds(day);
  const [received, reports, followUps] = await Promise.all([
    receivedToday(day, agentIds),
    pageAllParallel((a, b) => db.from("call_reports").select("id, agent_id").in("agent_id", agentIds)
      .not("submitted_at", "is", null).gte("submitted_at", start).lte("submitted_at", end).order("id").range(a, b)),
    pageAllParallel((a, b) => followUpWork(db as never, "current").select("id, agent_id")
      .in("agent_id", agentIds).in("status", ["upcoming", "rescheduled"]).order("id").range(a, b)),
  ]);
  if (reports.error || followUps.error) throw new Error("Progress counts unavailable");
  const count = (rows: Array<{ agent_id: string | null }>) => {
    const m = new Map<string, number>();
    for (const row of rows) if (row.agent_id) m.set(row.agent_id, (m.get(row.agent_id) ?? 0) + 1);
    return m;
  };
  return {
    received,
    reports: count((reports.data ?? []) as Array<{ agent_id: string | null }>),
    followUps: count((followUps.data ?? []) as Array<{ agent_id: string | null }>),
  };
}

export async function runDailyProgress(now = new Date()) {
  const { dhakaDateOf, isBusinessDay } = await import("@/lib/business-day");
  const { MAX_DAILY_LEADS_PER_AGENT } = await import("@/lib/lead-quota");
  const day = dhakaDateOf(now.getTime());
  if (!(await alertsEnabled())) return { skipped: "disabled" as const };
  if (!isBusinessDay(day)) return { skipped: "holiday" as const };
  const recipients = await optedInRecipients();
  if (recipients.length === 0) return { sent: 0, failed: 0 };
  const c = await progressCounts(day, recipients.map((r) => r.agentId));
  let sent = 0, failed = 0;
  for (const r of recipients) {
    const counts = {
      received: c.received.get(r.agentId) ?? 0, quota: MAX_DAILY_LEADS_PER_AGENT,
      reports: c.reports.get(r.agentId) ?? 0, followUps: c.followUps.get(r.agentId) ?? 0,
    };
    const outcome = await sendAlert({
      agentId: r.agentId, to: r.to, kind: "daily_progress", workDate: day,
      dedupeKey: `daily_progress:${r.agentId}:${day}`, template: AGENT_WA_TEMPLATES.dailyProgress,
      params: dailyProgressParams({ name: r.name, dayLabel: dayLabel(day), ...counts }), counts,
    });
    if (outcome === "sent") sent++; else if (outcome === "failed") failed++;
  }
  return { sent, failed };
}

/** One self-test per agent per Dhaka day, using their real progress counts. */
export async function sendSelfTest(agentId: string, name: string, number: string) {
  const { dhakaDateOf } = await import("@/lib/business-day");
  const { MAX_DAILY_LEADS_PER_AGENT } = await import("@/lib/lead-quota");
  const to = normalizeAgentWhatsApp(number);
  if (!to) throw new Error("Enter a valid Bangladesh mobile number first");
  const day = dhakaDateOf();
  const c = await progressCounts(day, [agentId]);
  const counts = {
    received: c.received.get(agentId) ?? 0, quota: MAX_DAILY_LEADS_PER_AGENT,
    reports: c.reports.get(agentId) ?? 0, followUps: c.followUps.get(agentId) ?? 0,
  };
  return sendAlert({
    agentId, to, kind: "test", workDate: day, dedupeKey: `test:${agentId}:${day}`,
    template: AGENT_WA_TEMPLATES.dailyProgress,
    params: dailyProgressParams({ name, dayLabel: dayLabel(day), ...counts }), counts,
  });
}

export async function readHqNumber(): Promise<string | null> {
  const db = await admin();
  const { data, error } = await db.from("system_settings").select("value").eq("key", AGENT_WA_HQ_NUMBER_KEY).maybeSingle();
  if (error) throw new Error("HQ number setting unavailable");
  return typeof data?.value === "string" ? normalizeAgentWhatsApp(data.value) : null;
}

export async function setHqNumber(raw: string | null) {
  const number = raw ? normalizeAgentWhatsApp(raw) : null;
  if (raw && !number) throw new Error("Enter a valid Bangladesh mobile number");
  const db = await admin();
  const { error } = await db.from("system_settings")
    .upsert({ key: AGENT_WA_HQ_NUMBER_KEY, value: number, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error("Could not save the HQ number");
  return number;
}

/** Agent sends today's own counts to the HQ WhatsApp number. Never includes customer details. */
export async function sendReportSummaryToHq(agentId: string, name: string) {
  if (!(await alertsEnabled())) throw new Error("IT has not switched on WhatsApp messages yet");
  const to = await readHqNumber();
  if (!to) throw new Error("IT has not set the HQ WhatsApp number yet");
  const { dhakaDateOf } = await import("@/lib/business-day");
  const { dhakaDayBounds } = await import("@/lib/accountability");
  const day = dhakaDateOf();
  const { start, end } = dhakaDayBounds(day);
  const db = await admin();
  const [reports, followUps] = await Promise.all([
    db.from("call_reports").select("id, connection_verified").eq("agent_id", agentId)
      .not("submitted_at", "is", null).gte("submitted_at", start).lte("submitted_at", end).limit(2000),
    db.from("follow_up_events").select("id", { count: "exact", head: true }).eq("agent_id", agentId)
      .gte("created_at", start).lte("created_at", end),
  ]);
  if (reports.error || followUps.error) throw new Error("Report counts unavailable");
  const counts = {
    reports: (reports.data ?? []).length,
    verifiedConnected: (reports.data ?? []).filter((r) => r.connection_verified === true).length,
    followUps: followUps.count ?? 0,
  };
  if (counts.reports === 0) throw new Error("No submitted reports today yet");
  const outcome = await sendAlert({
    agentId, to, kind: "hq_report", workDate: day, dedupeKey: hqReportDedupeKey(agentId, day, counts),
    template: AGENT_WA_TEMPLATES.hqReport,
    params: hqReportParams({ name, dayLabel: dayLabel(day), ...counts }), counts,
  });
  return { outcome, counts };
}

// ---------------------------------------------------------------- webhook inbox

type StatusItem = { id?: string; status?: string; timestamp?: string; errors?: Array<{ code?: number; title?: string; message?: string }> };
type InboundItem = { from?: string; id?: string; type?: string; text?: { body?: string } };

function changeValue(payload: unknown): Record<string, unknown> {
  const p = payload as { entry?: Array<{ changes?: Array<{ value?: Record<string, unknown> }> }> };
  return p?.entry?.[0]?.changes?.[0]?.value ?? {};
}

const stamp = (ts?: string) => (ts && /^\d+$/.test(ts) ? new Date(Number(ts) * 1000).toISOString() : null);

/** Applies stored status callbacks; returns false when the alert row isn't saved yet. */
async function applyStatus(item: StatusItem): Promise<boolean> {
  if (!item.id || !item.status) return true;
  const db = await admin();
  const { data, error } = await db.from("agent_whatsapp_alerts")
    .select("id, status, sent_at, delivered_at, read_at, failed_at, error_detail")
    .eq("provider_message_id", item.id).maybeSingle();
  if (error) throw new Error("Alert lookup failed");
  if (!data) return false;
  const at = stamp(item.timestamp) ?? new Date().toISOString();
  const status = nextAlertStatus(data.status as AgentAlertStatus, item.status);
  const s = item.status.toLowerCase();
  const patch = {
    status,
    sent_at: data.sent_at ?? (["sent", "delivered", "read"].includes(s) ? at : null),
    delivered_at: data.delivered_at ?? (["delivered", "read"].includes(s) ? at : null),
    read_at: data.read_at ?? (s === "read" ? at : null),
    failed_at: data.failed_at ?? (s === "failed" ? at : null),
    error_detail: s === "failed"
      ? (item.errors ?? []).map((e) => `${e.code ?? ""} ${e.title ?? e.message ?? ""}`.trim()).join("; ").slice(0, 500) || data.error_detail
      : data.error_detail,
    updated_at: new Date().toISOString(),
  };
  const saved = await db.from("agent_whatsapp_alerts").update(patch).eq("id", data.id);
  if (saved.error) throw new Error("Alert status update failed");
  return true;
}

/** Opt-out replies: agents stop alerts; anyone else goes on the global do-not-contact list. */
async function applyInbound(item: InboundItem): Promise<void> {
  if (!item.from || !isOptOutText(item.text?.body)) return;
  const db = await admin();
  const number = normalizeAgentWhatsApp(item.from);
  if (number) {
    const { data, error } = await db.from("agent_whatsapp_optins").update({
      opted_in: false, opted_out_at: new Date().toISOString(), opt_out_source: "whatsapp_reply", updated_at: new Date().toISOString(),
    }).eq("whatsapp_number", number).eq("opted_in", true).select("agent_id");
    if (error) throw new Error("Opt-out update failed");
    if ((data ?? []).length > 0) return;
  }
  const { normalizePhone } = await import("@/lib/ingest-resolve.server");
  const dnc = await db.from("do_not_contact").upsert({
    phone_number: normalizePhone(item.from), channel: "all",
    reason: "WhatsApp opt-out reply", source: "whatsapp_reply", added_by: null,
  }, { onConflict: "phone_number,channel" });
  if (dnc.error) throw new Error("Do-not-contact update failed");
}

/** Processes one stored event. "deferred" = a status arrived before its alert row. */
async function processEvent(event: string, payload: unknown): Promise<"done" | "deferred"> {
  const value = changeValue(payload);
  if (event === "whatsapp.status") {
    let deferred = false;
    for (const item of (value["statuses"] ?? []) as StatusItem[]) if (!(await applyStatus(item))) deferred = true;
    return deferred ? "deferred" : "done";
  }
  if (event === "whatsapp.message") {
    for (const item of (value["messages"] ?? []) as InboundItem[]) await applyInbound(item);
  }
  // Every other event (echoes, template reviews, account updates) stays stored as received.
  return "done";
}

const MAX_DEFERRALS = 6;

async function runStoredEvent(row: { id: string; event: string; payload: unknown; attempts: number }) {
  const db = await admin();
  try {
    const outcome = await processEvent(row.event, row.payload);
    const attempts = row.attempts + 1;
    const finished = outcome === "done" || attempts >= MAX_DEFERRALS;
    const saved = await db.from("whatsapp_webhook_events").update(finished
      ? { processed_at: new Date().toISOString(), attempts, processing_error: outcome === "deferred" ? "no matching CRM alert" : null }
      : { attempts, next_attempt_at: new Date(Date.now() + attempts * 5 * 60_000).toISOString(), processing_error: "waiting for alert record" },
    ).eq("id", row.id);
    if (saved.error) throw new Error("Event state update failed");
    return true;
  } catch (error) {
    const attempts = row.attempts + 1;
    await db.from("whatsapp_webhook_events").update({
      attempts, processing_error: error instanceof Error ? error.message.slice(0, 300) : "processing failed",
      next_attempt_at: new Date(Date.now() + Math.min(60, attempts * 5) * 60_000).toISOString(),
    }).eq("id", row.id);
    return false;
  }
}

/** Durable receipt first, then processing. Returns false when the delivery couldn't be stored or processed. */
export async function receiveWebhook(deliveryId: string, event: string, payload: unknown): Promise<boolean> {
  const db = await admin();
  const inserted = await db.from("whatsapp_webhook_events")
    .insert({ delivery_id: deliveryId, event, payload: payload as never }).select("id, event, payload, attempts, processed_at").single();
  let row = inserted.data;
  if (inserted.error) {
    if (inserted.error.code !== "23505") return false;
    const existing = await db.from("whatsapp_webhook_events").select("id, event, payload, attempts, processed_at")
      .eq("delivery_id", deliveryId).single();
    if (existing.error) return false;
    row = existing.data;
  }
  if (!row) return false;
  const ok = row.processed_at ? true : await runStoredEvent(row);
  await processPendingEvents(10);
  return ok;
}

/** Bounded, fair recovery: oldest next_attempt_at first, so blocked rows back off. */
export async function processPendingEvents(limit = 25) {
  const db = await admin();
  const { data, error } = await db.from("whatsapp_webhook_events").select("id, event, payload, attempts")
    .is("processed_at", null).lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at").limit(limit);
  if (error) return 0;
  let done = 0;
  for (const row of data ?? []) if (await runStoredEvent(row)) done++;
  return done;
}

/** Applies any status callbacks stored before the alert row had its message id. */
async function reconcileStoredStatuses(providerId: string) {
  const db = await admin();
  const { data } = await db.from("whatsapp_webhook_events").select("id, event, payload, attempts")
    .is("processed_at", null).eq("event", "whatsapp.status")
    .contains("payload", { entry: [{ changes: [{ value: { statuses: [{ id: providerId }] } }] }] }).limit(10);
  for (const row of data ?? []) await runStoredEvent(row);
}
