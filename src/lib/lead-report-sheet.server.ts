/**
 * Daily Lead Report → Google Sheet sync (server-only). Pushes the CRM's
 * assigned-lead snapshot for one Dhaka day into the workspace "WINSTONE
 * PULSE — Daily Lead Report" spreadsheet, one tab per Dhaka date, through
 * the Lovable connector gateway. Fail-closed when the Sheets connection is
 * not linked; the CRM stays the system of record — the sheet is a mirror.
 */
import { safeCell } from "@/lib/report-sheet.server";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SHEET_ID = "134iFJzfH8uwoAzTiEaAsyJcdtQUqwxEExBTmWiCUzA0";
const CONFIG_ID = "lead_report_sheet_sync";
const MAX_ROWS = 500;

export const LEAD_REPORT_HEADER = [
  "Lead",
  "Phone",
  "Agent",
  "Status",
  "Stage",
  "Visits",
  "Visits completed",
  "Bookings",
  "Payment status",
  "Last activity (Dhaka)",
  "Synced",
  "HQ note",
  "HQ payment (USD)",
  "Lead ID",
] as const;

export type LeadReportRow = {
  leadId: string;
  leadName: string;
  phone: string;
  agentName: string;
  status: string;
  stage: string;
  visits: number;
  visitsCompleted: number;
  bookings: number;
  paymentStatus: string;
  lastActivityDhaka: string;
};

/** Pure row mapping — spreadsheet cells are always formula-safe text. */
export function toLeadReportLine(row: LeadReportRow, syncedAt: string): string[] {
  return [
    row.leadName,
    row.phone,
    row.agentName,
    row.status,
    row.stage,
    String(row.visits),
    String(row.visitsCompleted),
    String(row.bookings),
    row.paymentStatus,
    row.lastActivityDhaka,
    syncedAt,
    "",
    "",
    row.leadId,
  ].map(safeCell);
}

export function dhakaDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dhakaTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Sheets সংযোগ কনফিগার করা নেই");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
  };
}

async function gatewayFetch(path: string, init?: RequestInit, attempt = 0): Promise<unknown> {
  const { recordSheetSyncEvent } = await import("@/lib/sheet-metrics.server");
  const operation = init?.method ? init.method.toLowerCase() : "read";
  const startedAt = Date.now();
  const response = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gatewayHeaders(), ...(init?.headers ?? {}) },
  });
  const body = await response.text();
  const durationMs = Date.now() - startedAt;
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1500 * 2 ** attempt + Math.floor(Math.random() * 400);
      await recordSheetSyncEvent({
        surface: "lead_report_sheet",
        operation,
        outcome: "retry",
        httpStatus: response.status,
        attempt,
        retryWaitMs: waitMs,
        durationMs,
        errorText: body,
      });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return gatewayFetch(path, init, attempt + 1);
    }
    console.error(`Sheets gateway failed [${response.status}]: ${body}`);
    await recordSheetSyncEvent({
      surface: "lead_report_sheet",
      operation,
      outcome: "failure",
      httpStatus: response.status,
      attempt,
      durationMs,
      errorText: body,
    });
    throw new Error(`Google Sheets ত্রুটি [${response.status}]: ${body.slice(0, 300)}`);
  }
  await recordSheetSyncEvent({
    surface: "lead_report_sheet",
    operation,
    outcome: "success",
    httpStatus: response.status,
    attempt,
    durationMs,
  });
  return body ? (JSON.parse(body) as unknown) : null;
}

/** Assigned leads with their agent, visit and booking counts. */
export async function fetchLeadReportRows(): Promise<LeadReportRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("id, name, phone_number, status, pipeline_stage, assigned_to, updated_at")
    .not("assigned_to", "is", null)
    .order("updated_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) throw new Error(error.message);
  const rows = leads ?? [];
  if (rows.length === 0) return [];

  const leadIds = rows.map((l) => l.id);
  const agentIds = [...new Set(rows.map((l) => l.assigned_to).filter((v): v is string => !!v))];

  const [profilesRes, visitsRes, bookingsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, name").in("id", agentIds),
    supabaseAdmin.from("site_visits").select("lead_id, status").in("lead_id", leadIds),
    supabaseAdmin.from("bookings").select("lead_id, status").in("lead_id", leadIds),
  ]);

  for (const result of [profilesRes, visitsRes, bookingsRes]) {
    if (result.error) throw new Error("Lead report related data unavailable");
  }

  const agentName = new Map((profilesRes.data ?? []).map((p) => [p.id, p.name ?? ""]));
  const visits = new Map<string, { total: number; done: number }>();
  for (const v of visitsRes.data ?? []) {
    const entry = visits.get(v.lead_id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (v.status === "completed") entry.done += 1;
    visits.set(v.lead_id, entry);
  }
  const bookings = new Map<string, number>();
  for (const b of bookingsRes.data ?? []) {
    bookings.set(b.lead_id, (bookings.get(b.lead_id) ?? 0) + 1);
  }

  return rows.map((l) => ({
    leadId: l.id,
    leadName: l.name ?? "",
    phone: l.phone_number ?? "",
    agentName: agentName.get(l.assigned_to ?? "") ?? "",
    status: l.status ?? "",
    stage: l.pipeline_stage ?? "",
    visits: visits.get(l.id)?.total ?? 0,
    visitsCompleted: visits.get(l.id)?.done ?? 0,
    bookings: bookings.get(l.id) ?? 0,
    paymentStatus: "—",
    lastActivityDhaka: dhakaTime(l.updated_at),
  }));
}

const readyTabs = new Set<string>();

async function ensureDayTab(tab: string) {
  if (readyTabs.has(tab)) return;
  const meta = (await gatewayFetch(
    `/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`,
  )) as { sheets?: { properties?: { title?: string } }[] } | null;
  const exists = (meta?.sheets ?? []).some((s) => s.properties?.title === tab);
  if (!exists) {
    await gatewayFetch(`/spreadsheets/${SHEET_ID}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
    });
  }
  await gatewayFetch(
    `/spreadsheets/${SHEET_ID}/values/${tab}!A1:N1?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: JSON.stringify({ values: [[...LEAD_REPORT_HEADER]] }) },
  );
  readyTabs.add(tab);
}

export type LeadReportSyncResult = {
  tab: string;
  rows: number;
  syncedAt: string;
  sheetUrl: string;
};

export function leadReportSheetUrl() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
}

/**
 * Rewrite the Dhaka-day tab so it mirrors the CRM exactly. Clears up to
 * MAX_ROWS + 1 lines so removed leads never linger as stale rows.
 */
export async function syncLeadReportToSheet(options?: { preserveExisting?: boolean }): Promise<LeadReportSyncResult> {
  const tab = dhakaDateLabel(new Date());
  const syncedAt = new Date().toISOString();
  const rows = await fetchLeadReportRows();

  await ensureDayTab(tab);
  if (options?.preserveExisting) {
    // Before the automated replacement, retain and verify every existing cell.
    const previous = (await gatewayFetch(`/spreadsheets/${SHEET_ID}/values/${tab}!A:N`)) as { values?: string[][] };
    const existing = previous.values ?? [];
    if (existing.length > 1) {
      const backupTab = `${tab}-backup-${crypto.randomUUID().slice(0, 8)}`;
      await gatewayFetch(`/spreadsheets/${SHEET_ID}:batchUpdate`, {
        method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: backupTab } } }] }),
      });
      await gatewayFetch(`/spreadsheets/${SHEET_ID}/values/${backupTab}!A1:N${existing.length}?valueInputOption=RAW`, {
        method: "PUT", body: JSON.stringify({ values: existing }),
      });
      const backup = (await gatewayFetch(`/spreadsheets/${SHEET_ID}/values/${backupTab}!A:N`)) as { values?: string[][] };
      if (JSON.stringify(backup.values ?? []) !== JSON.stringify(existing)) {
        throw new Error("Lead report backup verification failed");
      }
    }
    const updates = planScheduledLeadReportRows(existing.slice(1), rows, syncedAt);
    if (updates.length > 0) {
      await gatewayFetch(`/spreadsheets/${SHEET_ID}/values:batchUpdate`, {
        method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data: updates.map((update) => ({
          range: `${tab}!A${update.rowNumber}:N${update.rowNumber}`, values: [update.values],
        })) }),
      });
    }
  } else {
  const values = rows.map((row) => toLeadReportLine(row, syncedAt));
  const blank = Array.from({ length: LEAD_REPORT_HEADER.length }, () => "");
  const padded = [...values];
  while (padded.length < MAX_ROWS) padded.push(blank);

  await gatewayFetch(
    `/spreadsheets/${SHEET_ID}/values/${tab}!A2:N${MAX_ROWS + 1}?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: JSON.stringify({ values: padded }) },
  );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("app_config").upsert({
    id: CONFIG_ID,
    data: { lastSyncedAt: syncedAt, tab, rowCount: rows.length },
  });

  return { tab, rows: rows.length, syncedAt, sheetUrl: leadReportSheetUrl() };
}

/** Update known lead rows, append new ones, never clear old leads or HQ cells. */
export function planScheduledLeadReportRows(existing: string[][], rows: LeadReportRow[], syncedAt: string) {
  const positions = new Map<string, number>();
  existing.forEach((line, index) => {
    const id = line[13];
    if (!id) return;
    if (positions.has(id)) throw new Error("Duplicate lead IDs in existing report");
    positions.set(id, index);
  });
  let nextRow = existing.length + 2;
  return rows.map((row) => {
    const index = positions.get(row.leadId);
    const values = toLeadReportLine(row, syncedAt);
    if (index !== undefined) {
      values[11] = existing[index]?.[11] ?? "";
      values[12] = existing[index]?.[12] ?? "";
    }
    return { rowNumber: index === undefined ? nextRow++ : index + 2, values };
  });
}

export async function readLeadReportSyncState() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("data")
    .eq("id", CONFIG_ID)
    .maybeSingle();
  return (data?.data ?? {}) as { lastSyncedAt?: string; tab?: string; rowCount?: number };
}
