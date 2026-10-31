/**
 * Daily 17:40 Dhaka HQ WhatsApp report (server only).
 * Builds a Bangla PDF of team + per-agent counts, stores it in the private
 * hq-daily-reports bucket, and sends it from the official WhatsApp number to
 * the configured HQ recipients. Falls back to the text summary until Meta has
 * approved the PDF template. One send per recipient per Dhaka day.
 */
import {
  HQ_REPORT_ENABLED_KEY, HQ_REPORT_RECIPIENTS_KEY, HQ_REPORT_TEMPLATES, hqSummaryParams, hqTotals,
  normalizeRecipientList, type AgentDayRow,
} from "@/lib/hq-daily-report";

const BUCKET = "hq-daily-reports";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function readHqReportSettings() {
  const db = await admin();
  const { data, error } = await db.from("system_settings").select("key, value")
    .in("key", [HQ_REPORT_ENABLED_KEY, HQ_REPORT_RECIPIENTS_KEY]);
  if (error) throw new Error("HQ report settings unavailable");
  const get = (k: string) => data?.find((r) => r.key === k)?.value;
  return { enabled: get(HQ_REPORT_ENABLED_KEY) === true, recipients: normalizeRecipientList(get(HQ_REPORT_RECIPIENTS_KEY)) };
}

/** Per-agent counts for one Dhaka day, from authoritative rows only. Fails on any partial read. */
export async function collectDayRows(day: string): Promise<AgentDayRow[]> {
  const db = await admin();
  const { activeAgents } = await import("@/lib/lead-pool.server");
  const { readAllocationReceipts } = await import("@/lib/allocation-ledger.server");
  const { dhakaDayBounds } = await import("@/lib/accountability");
  const { pageAllParallel } = await import("@/lib/page-all");
  const agents = await activeAgents();
  if (agents.length === 0) return [];
  const ids = agents.map((a) => a.id);
  const { start, end } = dhakaDayBounds(day);
  const [receipts, reports, followUps] = await Promise.all([
    readAllocationReceipts(day, ids),
    pageAllParallel((a, b) => db.from("call_reports").select("id, agent_id, connection_verified").in("agent_id", ids)
      .not("submitted_at", "is", null).gte("submitted_at", start).lte("submitted_at", end).order("id").range(a, b)),
    pageAllParallel((a, b) => db.from("follow_up_events").select("id, agent_id").in("agent_id", ids)
      .gte("created_at", start).lte("created_at", end).order("id").range(a, b)),
  ]);
  if (reports.error || followUps.error) throw new Error("Daily report counts unavailable");
  const leads = new Map<string, Set<string>>();
  for (const r of receipts) (leads.get(r.agent_id) ?? leads.set(r.agent_id, new Set()).get(r.agent_id)!).add(r.lead_id);
  const rep = new Map<string, { n: number; v: number }>();
  for (const r of (reports.data ?? []) as Array<{ agent_id: string | null; connection_verified: boolean | null }>) {
    if (!r.agent_id) continue;
    const cur = rep.get(r.agent_id) ?? { n: 0, v: 0 };
    cur.n++; if (r.connection_verified === true) cur.v++;
    rep.set(r.agent_id, cur);
  }
  const fu = new Map<string, number>();
  for (const r of (followUps.data ?? []) as Array<{ agent_id: string | null }>) if (r.agent_id) fu.set(r.agent_id, (fu.get(r.agent_id) ?? 0) + 1);
  return agents.map((a) => ({
    name: a.name, received: leads.get(a.id)?.size ?? 0,
    reports: rep.get(a.id)?.n ?? 0, verifiedConnected: rep.get(a.id)?.v ?? 0, newFollowUps: fu.get(a.id) ?? 0,
  }));
}

async function pdfTemplateApproved(): Promise<boolean> {
  const { gateway } = await import("@/lib/agent-whatsapp.server");
  const res = await gateway(`/message_templates?fields=name,status,language&limit=100`, { method: "GET" });
  if (!res.ok) return false;
  const rows = ((await res.json()) as { data?: Array<{ name: string; status: string; language: string }> }).data ?? [];
  return rows.some((r) => r.name === HQ_REPORT_TEMPLATES.pdf && r.language === "bn" && r.status === "APPROVED");
}

async function sendOne(input: { to: string; day: string; params: string[]; counts: Record<string, number>; pdf: { path: string; url: string } | null }) {
  const db = await admin();
  const template = input.pdf ? HQ_REPORT_TEMPLATES.pdf : HQ_REPORT_TEMPLATES.text;
  const reserve = await db.from("hq_whatsapp_report_sends").insert({
    recipient: input.to, work_date: input.day, dedupe_key: `hq_daily:${input.to}:${input.day}`, template,
    with_pdf: Boolean(input.pdf), pdf_path: input.pdf?.path ?? null, counts: input.counts, status: "sending",
  }).select("id").single();
  if (reserve.error) {
    if (reserve.error.code === "23505") return "duplicate" as const;
    throw new Error("Could not reserve the HQ report send");
  }
  const { gateway, reconcileStoredStatuses } = await import("@/lib/agent-whatsapp.server");
  const components: unknown[] = [];
  if (input.pdf) components.push({ type: "header", parameters: [{ type: "document", document: { link: input.pdf.url, filename: `Winstone-daily-report-${input.day}.pdf` } }] });
  components.push({ type: "body", parameters: input.params.map((text) => ({ type: "text", text })) });
  let providerId: string | null = null, errorDetail: string | null = null;
  try {
    const res = await gateway("/messages", { method: "POST", body: JSON.stringify({
      messaging_product: "whatsapp", to: input.to, type: "template",
      template: { name: template, language: { code: "bn" }, components },
    }) });
    const body = await res.text();
    if (res.ok) providerId = (JSON.parse(body).messages?.[0]?.id as string | undefined) ?? null;
    else errorDetail = `[${res.status}] ${body.slice(0, 500)}`;
  } catch (e) {
    errorDetail = e instanceof Error ? e.message.slice(0, 300) : "send failed";
  }
  const now = new Date().toISOString();
  const saved = await db.from("hq_whatsapp_report_sends").update(providerId
    ? { status: "accepted", provider_message_id: providerId, updated_at: now }
    : { status: "failed", error_detail: errorDetail, failed_at: now, updated_at: now }).eq("id", reserve.data.id);
  if (saved.error) throw new Error("HQ report sent but its record could not be saved");
  if (providerId) await reconcileStoredStatuses(providerId);
  return providerId ? ("sent" as const) : ("failed" as const);
}

export async function runHqDailyReport(now = new Date()) {
  const { dhakaDateOf, isBusinessDay } = await import("@/lib/business-day");
  const day = dhakaDateOf(now.getTime());
  const settings = await readHqReportSettings();
  if (!settings.enabled) return { skipped: "disabled" as const };
  if (!isBusinessDay(day)) return { skipped: "holiday" as const };
  if (settings.recipients.length === 0) return { skipped: "no_recipients" as const };

  const rows = await collectDayRows(day);
  const totals = hqTotals(rows);
  const db = await admin();
  let pdf: { path: string; url: string } | null = null;
  let pdfStored = false;
  try {
    const { buildHqDailyReportPdf } = await import("@/lib/hq-daily-report-pdf.server");
    const bytes = await buildHqDailyReportPdf({ day, rows, generatedAt: now });
    const path = `${day.slice(0, 7)}/winstone-daily-report-${day}.pdf`;
    const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) throw up.error;
    pdfStored = true;
    if (await pdfTemplateApproved()) {
      const signed = await db.storage.from(BUCKET).createSignedUrl(path, 6 * 3600);
      if (signed.error || !signed.data?.signedUrl) throw new Error("signed link failed");
      pdf = { path, url: signed.data.signedUrl };
    }
  } catch (e) {
    console.error("[hq-daily-report] PDF step failed", e instanceof Error ? e.message : e);
  }

  const params = hqSummaryParams(day, totals);
  let sent = 0, failed = 0;
  for (const to of settings.recipients) {
    const outcome = await sendOne({ to, day, params, counts: totals, pdf });
    if (outcome === "sent") sent++; else if (outcome === "failed") failed++;
  }
  return { sent, failed, withPdf: Boolean(pdf), pdfStored };
}
