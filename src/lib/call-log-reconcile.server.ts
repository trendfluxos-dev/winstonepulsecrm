import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  CALL_LOG_MATCH_WINDOW_MS,
  callLogReconcilePatch,
  pendingReportDurationPatch,
  pickCallLogMatch,
} from "@/lib/call-reconciliation";

export type ReconcileResult = {
  recordingId: string;
  leadId: string | null;
  callStatus: string;
  /** false = this call-log entry had already reconciled the row (retry). */
  reconciled: boolean;
  duplicateOf: string | null;
  previous: { call_status: string; duration_seconds: number } | null;
};

/**
 * Applies a late Android call-log entry to the live call row of the same
 * physical call. Returns null when no unique, same-agent row matches; the
 * caller then stores the call-log entry as its own row (idempotent on call_uid).
 * Never touches another agent's row and never changes a submitted report.
 */
export async function reconcileLateCallLog(
  db: SupabaseClient<Database>,
  input: {
    agentId: string;
    phone: string;
    callUid: string;
    state: "completed" | "no_answer";
    durationSeconds: number | undefined;
    at: string;
    nowIso?: string;
  },
): Promise<ReconcileResult | null> {
  const atMs = Date.parse(input.at);
  if (!Number.isFinite(atMs)) return null;
  const nowIso = input.nowIso ?? new Date().toISOString();
  const columns =
    "id, agent_id, lead_id, external_call_id, call_log_id, started_at, call_status, call_direction, answered_at, finished_at, duration_seconds, device_reported_duration_seconds";
  const { data: near, error } = await db
    .from("call_recordings")
    .select(columns)
    .eq("agent_id", input.agentId)
    .eq("phone_number", input.phone)
    .gte("started_at", new Date(atMs - CALL_LOG_MATCH_WINDOW_MS).toISOString())
    .lte("started_at", new Date(atMs + CALL_LOG_MATCH_WINDOW_MS).toISOString())
    .limit(10);
  if (error) throw new Error("Call reconciliation failed");

  const match = pickCallLogMatch(near ?? [], { agentId: input.agentId, callUid: input.callUid, atMs });
  if (match.kind === "already_reconciled") {
    return {
      recordingId: match.row.id,
      leadId: match.row.lead_id,
      callStatus: match.row.call_status,
      reconciled: false,
      duplicateOf: match.row.external_call_id,
      previous: null,
    };
  }
  if (match.kind !== "matched") return null;

  const row = match.row;
  const patch = callLogReconcilePatch(
    row,
    { state: input.state, durationSeconds: input.durationSeconds, atMs, callUid: input.callUid },
    nowIso,
  );
  const { data: updated, error: updateError } = await db
    .from("call_recordings")
    .update(patch)
    .eq("id", row.id)
    .eq("agent_id", input.agentId)
    .is("call_log_id", null)
    .select("id");
  if (updateError) throw new Error("Call reconciliation failed");
  if (!updated || updated.length === 0) {
    // Lost a race: only report success when the winner was this same call-log entry.
    const { data: winner } = await db
      .from("call_recordings")
      .select("id, agent_id, lead_id, external_call_id, call_status")
      .eq("call_log_id", input.callUid)
      .maybeSingle();
    if (!winner || winner.agent_id !== input.agentId) return null;
    return { recordingId: winner.id, leadId: winner.lead_id, callStatus: winner.call_status, reconciled: false, duplicateOf: winner.external_call_id, previous: null };
  }

  // Only a still-pending report follows; submitted history is never rewritten.
  const { error: reportError } = await db
    .from("call_reports")
    .update(pendingReportDurationPatch(patch, input.durationSeconds ?? 0, nowIso))
    .eq("recording_id", row.id)
    .eq("agent_id", input.agentId)
    .eq("status", "pending");
  if (reportError) throw new Error("Call reconciliation failed");

  return {
    recordingId: row.id,
    leadId: row.lead_id,
    callStatus: patch.call_status,
    reconciled: true,
    duplicateOf: row.external_call_id,
    previous: { call_status: row.call_status, duration_seconds: row.duration_seconds },
  };
}
