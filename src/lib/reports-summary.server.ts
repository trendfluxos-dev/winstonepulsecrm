/**
 * Own-work reports summary for the Winstone Connect Android app.
 *
 * Auth is the per-agent device token only (x-device-token). The shared server
 * secret is NOT accepted here: this feed was previously reachable with a secret
 * shipped inside an APK, so it now refuses that path entirely. The agent is
 * resolved server-side from the token; client-supplied employee_id / agent_id /
 * role can never widen scope. Company-wide reports stay on the web Reports
 * screen behind its existing role checks.
 */
import { z } from "zod";

import type { CallRecording, Lead, Profile, WhatsappMessage } from "@/lib/crm-data";
import { buildReport, defaultFilters, isoDay, type ReportResult } from "@/lib/crm-reports";
import type { ApiCaller } from "@/lib/device-auth.server";

export const MAX_RANGE_DAYS = 92;
const AGENT_ROLES = new Set(["agent", "team_leader"]);

const Query = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    employee_id: z.string().trim().min(2).max(32).optional(),
    agent_id: z.string().uuid().optional(),
    source: z.string().trim().max(64).default("all"),
    status: z.enum(["all", "pending", "contacted", "follow_up", "closed"]).default("all"),
  })
  .strict();

export type OwnReportData = {
  leads: Lead[];
  calls: CallRecording[];
  messages: WhatsappMessage[];
};

export type ReportsSummaryDeps = {
  resolveCaller: (request: Request) => Promise<ApiCaller>;
  /** Loads only rows owned by `agentId` from `fromIso` onward. */
  loadOwnData: (agentId: string, fromIso: string) => Promise<OwnReportData>;
  now?: () => Date;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function validDay(day: string): boolean {
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

export async function handleReportsSummary(
  request: Request,
  deps: ReportsSummaryDeps,
): Promise<Response> {
  const caller = await deps.resolveCaller(request);
  if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);
  const profile = caller.profile as Profile;
  if (!AGENT_ROLES.has(String(profile.role))) {
    return json({ error: "Reports summary covers sales agents' own work only" }, 403);
  }

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return json({ error: "Invalid query" }, 400);
  const q = parsed.data;

  // Identity hints are accepted only when they name the caller themselves.
  if (q.agent_id && q.agent_id !== profile.id) return json({ error: "Forbidden" }, 403);
  if (q.employee_id && q.employee_id.toUpperCase() !== String(profile.employee_id ?? "").toUpperCase()) {
    return json({ error: "Forbidden" }, 403);
  }

  const now = deps.now?.() ?? new Date();
  const from = q.from ?? defaultFilters(30, now).from;
  const to = q.to ?? isoDay(now);
  if (!validDay(from) || !validDay(to)) return json({ error: "Invalid date" }, 400);
  if (from > to) return json({ error: "from must be on or before to" }, 400);
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days > MAX_RANGE_DAYS) return json({ error: `Range is limited to ${MAX_RANGE_DAYS} days` }, 400);

  let data: OwnReportData;
  try {
    data = await deps.loadOwnData(profile.id, `${from}T00:00:00Z`);
  } catch {
    return json({ error: "Report temporarily unavailable" }, 503);
  }

  const report: ReportResult = buildReport(
    { profiles: [profile], ...data },
    { from, to, agentId: profile.id, source: q.source, status: q.status, query: "", sentiment: "all" },
  );
  const own = report.rows.find((r) => r.agentId === profile.id) ?? null;

  return json({
    ok: true,
    scope: "own",
    server_time: now.toISOString(),
    filters: { from, to, source: q.source, status: q.status },
    totals: report.totals,
    daily: report.daily,
    status_mix: report.statusMix,
    source_mix: report.sourceMix,
    sentiment_mix: report.sentimentMix,
    me: own,
  });
}

/** Production loader: owner-scoped reads only, never company-wide tables. */
export async function loadOwnReportData(agentId: string, fromIso: string): Promise<OwnReportData> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [leadsRes, callsRes, messagesRes] = await Promise.all([
    supabaseAdmin.from("leads").select("*").or(`assigned_to.eq.${agentId},assigned_agent_id.eq.${agentId}`),
    supabaseAdmin.from("call_recordings").select("*").eq("agent_id", agentId).gte("created_at", fromIso),
    supabaseAdmin.from("whatsapp_interactions").select("*").eq("agent_id", agentId).gte("created_at", fromIso),
  ]);
  const failed = [leadsRes, callsRes, messagesRes].find((r) => r.error);
  if (failed?.error) throw new Error("report read failed");
  // buildReport attributes leads by assigned_to; align the canonical owner.
  const leads = ((leadsRes.data ?? []) as Lead[]).map((l) => ({ ...l, assigned_to: agentId }));
  return {
    leads,
    calls: (callsRes.data ?? []) as CallRecording[],
    messages: (messagesRes.data ?? []) as WhatsappMessage[],
  };
}
