/** One physical call key; upload identity is separate from recording availability. */
export type AudioEvidence = {
  id?: string;
  agent_id?: string | null;
  lead_id?: string | null;
  storage_path?: string | null;
  audio_url?: string | null;
  checksum?: string | null;
  recording_status?: string | null;
  upload_status?: string | null;
  call_status?: string | null;
};

export function audioStored(row: AudioEvidence) {
  return Boolean(row.storage_path || row.audio_url) &&
    ["uploaded", "verified", "stored"].includes(row.upload_status ?? "");
}

export function recordingAvailability(row: AudioEvidence): "available" | "pending" | "not_available" | "unknown" {
  if (audioStored(row)) return "available"; // legacy stored and current available share one read contract
  if (row.recording_status === "not_available") return "not_available";
  if (row.recording_status === "pending") return "pending";
  return "unknown";
}

export function assertAudioIdentity(row: AudioEvidence, agentId: string | null, leadId: string, checksum: string) {
  if (row.agent_id !== agentId || row.lead_id !== leadId) throw new Error("CALL_IDENTITY_CONFLICT");
  if ((row.storage_path || row.audio_url) && row.checksum !== checksum) throw new Error("AUDIO_CHECKSUM_CONFLICT");
}

export async function audioChecksum(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

const phase: Record<string, number> = { initiated: 0, ringing: 1, answered: 2, completed: 3, failed: 3, no_answer: 3 };
/** Offline replay cannot downgrade a terminal call or discard an already stored file. */
export function reconcileLifecycle(row: AudioEvidence, incoming: { call_status: string; recording_status: string }) {
  const oldPhase = phase[row.call_status ?? ""] ?? -1;
  const newPhase = phase[incoming.call_status] ?? -1;
  return {
    call_status: oldPhase >= newPhase ? row.call_status ?? incoming.call_status : incoming.call_status,
    recording_status: audioStored(row) ? "available" : incoming.recording_status,
  };
}

export function uploadConfirmed(value: { recording_id?: unknown; upload_status?: unknown; checksum?: unknown }, expectedChecksum: string) {
  return typeof value.recording_id === "string" && value.recording_id.trim().length > 0 &&
    expectedChecksum.trim().length > 0 && value.upload_status === "uploaded" && value.checksum === expectedChecksum;
}
/** Remove stale observation fields as well as preserving statuses on offline replay. */
export function lifecyclePatch(row: AudioEvidence, patch: { call_status: string; recording_status: string; agent_phone?: string | null; started_at?: string; answered_at?: string; finished_at?: string; duration_seconds?: number }) {
  const reconciled = reconcileLifecycle(row, patch);
  if ((phase[row.call_status ?? ""] ?? -1) >= (phase[patch.call_status] ?? -1)) return reconciled;
  return { ...patch, ...reconciled };
}

/**
 * Phone-recorder audio is matched to a call after the fact on the phone, so it
 * must carry that call's id; the server then binds it to the existing call row
 * of the same agent and lead (assertAudioIdentity) or creates it under that id.
 * Without a call id it is refused, never attached by lead or time alone.
 */
export function recordingBindingError(body: { recorder_source?: string | null | undefined; call_uid?: string | null | undefined }): string | null {
  if (body.recorder_source === "phone_recorder" && !String(body.call_uid ?? "").trim()) {
    return "Phone recorder audio must include its call id";
  }
  return null;
}

/**
 * Fields stored only when the phone proved the call's result from Android's call
 * history (app 2.22+ sends talk_time_source = "call_log" with a terminal state).
 * App 2.21 never sends it, so its ringing-inclusive time stays unproven.
 */
export function talkTimeEvidence(body: {
  state: string;
  talk_time_source?: string | undefined;
  duration_seconds?: number | undefined;
}): { talk_time_source: "call_log"; duration_seconds: number; call_status: string } | Record<string, never> {
  if (body.talk_time_source !== "call_log") return {};
  if (body.state !== "completed" && body.state !== "no_answer") return {};
  const seconds = typeof body.duration_seconds === "number" && body.duration_seconds > 0 ? body.duration_seconds : 0;
  if (body.state === "completed" && seconds === 0) return {}; // completed needs talk time
  return { talk_time_source: "call_log", duration_seconds: body.state === "completed" ? seconds : 0, call_status: body.state };
}

/**
 * Late call-log reconciliation (G2). A call-log row reported by the phone after
 * the call ended is matched to the live row the app already reported for the
 * same physical call, so the CRM keeps ONE call row carrying Android's own
 * CallLog.DURATION and type instead of the live (ringing-inclusive) time.
 *
 * Matching is conservative: same agent only, never a row that is itself a
 * call-log row or was already reconciled by a different call-log entry, within
 * ±150 s of the call-log start. With several such rows only a single row within
 * ±30 s is accepted; anything else is ambiguous and never merged.
 */
export const CALL_LOG_MATCH_WINDOW_MS = 150_000;
export const CALL_LOG_TIGHT_WINDOW_MS = 30_000;

export type CallLogCandidate = {
  id: string;
  agent_id: string | null;
  external_call_id: string | null;
  call_log_id?: string | null;
  started_at: string | null;
};

export type CallLogMatch<T extends CallLogCandidate> =
  | { kind: "matched"; row: T }
  | { kind: "already_reconciled"; row: T }
  | { kind: "own_row" }
  | { kind: "none" }
  | { kind: "ambiguous"; count: number };

export function pickCallLogMatch<T extends CallLogCandidate>(
  candidates: readonly T[],
  input: { agentId: string; callUid: string; atMs: number },
): CallLogMatch<T> {
  const mine = candidates.filter((c) => c.agent_id === input.agentId);
  // A retry of a call-log row that was stored as its own row: normal path updates it.
  if (mine.some((c) => c.external_call_id === input.callUid)) return { kind: "own_row" };
  const done = mine.find((c) => c.call_log_id === input.callUid);
  if (done) return { kind: "already_reconciled", row: done };
  if (!Number.isFinite(input.atMs)) return { kind: "none" };
  const eligible = mine
    .filter((c) => !String(c.external_call_id ?? "").startsWith("log-") && !c.call_log_id)
    .map((c) => ({ c, gap: Math.abs(new Date(c.started_at ?? "").getTime() - input.atMs) }))
    .filter((x) => Number.isFinite(x.gap) && x.gap <= CALL_LOG_MATCH_WINDOW_MS);
  if (eligible.length === 0) return { kind: "none" };
  if (eligible.length === 1) return { kind: "matched", row: eligible[0]!.c };
  const tight = eligible.filter((x) => x.gap <= CALL_LOG_TIGHT_WINDOW_MS);
  if (tight.length === 1) return { kind: "matched", row: tight[0]!.c };
  return { kind: "ambiguous", count: eligible.length };
}

/**
 * Fields written onto the matched live row. Call-log state/duration are
 * authoritative (they replace live dial-to-hang-up time). An incoming row the
 * phone saw answered (answered_at) is never downgraded to "no_answer" — older
 * apps label a 0-second answered incoming call that way — but it still gets
 * 0 talk seconds, so it can never prove a connection.
 */
export function callLogReconcilePatch(
  row: { call_direction?: string | null; answered_at?: string | null; finished_at?: string | null; device_reported_duration_seconds?: number | null },
  log: { state: "completed" | "no_answer"; durationSeconds: number | undefined; atMs: number; callUid: string },
  nowIso: string,
) {
  const seconds = Math.max(0, Math.floor(Number(log.durationSeconds) || 0));
  const answeredIncoming = row.call_direction === "incoming_callback" && Boolean(row.answered_at);
  const status = log.state === "completed" || answeredIncoming ? "completed" : "no_answer";
  return {
    call_status: status,
    duration_seconds: status === "completed" ? seconds : 0,
    // Keep the earlier device claim when one exists; otherwise store the phone's measurement.
    ...(row.device_reported_duration_seconds == null ? { device_reported_duration_seconds: seconds } : {}),
    talk_time_source: "call_log" as const,
    talk_time_verified_at: nowIso,
    call_log_id: log.callUid,
    ...(!row.finished_at && Number.isFinite(log.atMs) ? { finished_at: new Date(log.atMs + seconds * 1000).toISOString() } : {}),
  };
}

/** Duration fields copied onto a still-pending report linked to the reconciled row. Nothing else changes. */
export function pendingReportDurationPatch(patch: { duration_seconds: number }, seconds: number, nowIso: string) {
  return {
    duration_seconds: patch.duration_seconds,
    device_reported_duration_seconds: Math.max(0, Math.floor(seconds)),
    duration_source: "phone_sync",
    duration_synced_at: nowIso,
  };
}
