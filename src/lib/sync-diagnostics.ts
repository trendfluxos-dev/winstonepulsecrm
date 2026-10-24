import { uploadConfirmed } from "@/lib/call-reconciliation";

/**
 * Privacy-safe phone-sync diagnostics. Only allow-listed technical fields leave
 * the device or reach logs: no phone numbers, names, transcripts, audio, URLs or tokens.
 * Call IDs and checksums are reduced to short one-way fingerprints.
 */
export async function fingerprint(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wsdiag:${value}`));
  return Array.from(new Uint8Array(digest).slice(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type SyncStage = "lifecycle" | "report_open" | "report_submit" | "audio_pickup" | "audio_upload";

export type RawDiagnostic = {
  stage: SyncStage;
  callUid?: string | null;
  checksum?: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  attempt?: number;
  fileBytes?: number | null;
  mimeType?: string | null;
  permissionGranted?: boolean | null;
  osVersion?: string | null;
  manufacturer?: string | null;
  at?: string;
  [extra: string]: unknown; // anything else (phone, transcript, token…) is dropped
};

export type SafeDiagnostic = {
  stage: SyncStage;
  callRef: string | null;
  checksumRef: string | null;
  reason: FailureReason;
  httpStatus: number | null;
  attempt: number;
  sizeBucket: "none" | "<100KB" | "<1MB" | "<10MB" | ">=10MB";
  mimeType: string | null;
  permissionGranted: boolean | null;
  osVersion: string | null;
  manufacturer: string | null;
  at: string | null;
};

function bucket(bytes: number | null | undefined): SafeDiagnostic["sizeBucket"] {
  if (!bytes || bytes <= 0) return "none";
  if (bytes < 100_000) return "<100KB";
  if (bytes < 1_000_000) return "<1MB";
  if (bytes < 10_000_000) return "<10MB";
  return ">=10MB";
}
const short = (v: string | null | undefined, max = 40) =>
  v ? v.replace(/[^\w.\- /]/g, "").slice(0, max) || null : null;

export async function redactDiagnostic(raw: RawDiagnostic): Promise<SafeDiagnostic> {
  return {
    stage: raw.stage,
    callRef: await fingerprint(raw.callUid),
    checksumRef: await fingerprint(raw.checksum),
    reason: classifySyncFailure(raw).reason,
    httpStatus: typeof raw.httpStatus === "number" ? raw.httpStatus : null,
    attempt: Math.max(0, Math.min(99, Math.floor(raw.attempt ?? 0))),
    sizeBucket: bucket(raw.fileBytes),
    mimeType: /^audio\/[\w.+-]{1,30}$/.test(raw.mimeType ?? "") ? raw.mimeType! : null,
    permissionGranted: typeof raw.permissionGranted === "boolean" ? raw.permissionGranted : null,
    osVersion: short(raw.osVersion, 20),
    manufacturer: short(raw.manufacturer, 30),
    at: raw.at && !Number.isNaN(Date.parse(raw.at)) ? new Date(raw.at).toISOString() : null,
  };
}

export type FailureReason =
  | "ok" | "permission_denied" | "file_missing" | "no_matching_recording" | "offline"
  | "auth_expired" | "lifecycle_not_synced" | "identity_conflict" | "checksum_conflict"
  | "rate_limited" | "server_error" | "unconfirmed_ack" | "unknown";

const COPY: Record<FailureReason, { bn: string; en: string; retryable: boolean }> = {
  ok: { bn: "সফল", en: "Succeeded", retryable: false },
  permission_denied: { bn: "অডিও ফাইল পড়ার অনুমতি নেই — ফোনের সেটিংসে অনুমতি দিন", en: "No permission to read audio — grant it in phone settings", retryable: true },
  file_missing: { bn: "রেকর্ডিং ফাইল ফোনে পাওয়া যায়নি", en: "Recording file is missing on the phone", retryable: false },
  no_matching_recording: { bn: "এই কলের সঙ্গে মেলে এমন ফোন রেকর্ডিং নেই — কল রিপোর্ট আলাদাভাবে সিঙ্ক হয়", en: "No phone recording matches this call — the call report syncs separately", retryable: true },
  offline: { bn: "ইন্টারনেট নেই — সংযোগ ফিরলে আবার চেষ্টা হবে", en: "Offline — will retry when connected", retryable: true },
  auth_expired: { bn: "ডিভাইস সাইন-ইন মেয়াদোত্তীর্ণ — আবার সাইন ইন করুন", en: "Device sign-in expired — sign in again", retryable: true },
  lifecycle_not_synced: { bn: "কলের তথ্য এখনও সার্ভারে পৌঁছায়নি — একটু পরে আবার চেষ্টা হবে", en: "Call details have not reached the server yet — retrying", retryable: true },
  identity_conflict: { bn: "কলটি অন্য এজেন্ট বা লিডের সঙ্গে যুক্ত — আইটি দেখবে", en: "Call belongs to another agent or lead — IT review needed", retryable: false },
  checksum_conflict: { bn: "এই কলে আগে থেকে ভিন্ন অডিও আছে — আইটি দেখবে", en: "Different audio is already stored for this call — IT review needed", retryable: false },
  rate_limited: { bn: "সার্ভার ব্যস্ত — পরে আবার চেষ্টা হবে", en: "Server busy — will retry later", retryable: true },
  server_error: { bn: "সার্ভারে সমস্যা — পরে আবার চেষ্টা হবে", en: "Server problem — will retry later", retryable: true },
  unconfirmed_ack: { bn: "সার্ভার আপলোড নিশ্চিত করেনি — ফাইল ফোনে রাখা হয়েছে", en: "Server did not confirm the upload — file kept on phone", retryable: true },
  unknown: { bn: "অজানা সমস্যা — আবার চেষ্টা হবে", en: "Unknown problem — will retry", retryable: true },
};

export function classifySyncFailure(raw: Pick<RawDiagnostic, "httpStatus" | "errorCode" | "permissionGranted">): { reason: FailureReason; bn: string; en: string; retryable: boolean } {
  const code = (raw.errorCode ?? "").toUpperCase();
  let reason: FailureReason;
  if (raw.permissionGranted === false) reason = "permission_denied";
  else if (code === "CALL_IDENTITY_CONFLICT" || code === "AUDIO_CONTENT_ALREADY_LINKED") reason = "identity_conflict";
  else if (code === "AUDIO_CHECKSUM_CONFLICT") reason = "checksum_conflict";
  else if (code === "FILE_MISSING") reason = "file_missing";
  else if (code === "NO_MATCHING_RECORDING") reason = "no_matching_recording";
  else if (code === "UNCONFIRMED_ACK") reason = "unconfirmed_ack";
  else if (code === "OFFLINE" || raw.httpStatus === 0) reason = "offline";
  else if (raw.httpStatus === 401 || raw.httpStatus === 403) reason = "auth_expired";
  else if (raw.httpStatus === 409) reason = "lifecycle_not_synced";
  else if (raw.httpStatus === 429) reason = "rate_limited";
  else if (raw.httpStatus && raw.httpStatus >= 500) reason = "server_error";
  else if (raw.httpStatus && raw.httpStatus >= 200 && raw.httpStatus < 300 && !code) reason = "ok";
  else reason = "unknown";
  return { reason, ...COPY[reason] };
}

/** Report sync and audio upload are separate evidence; audio is stored only on a matching server ack. */
export type CallSyncState = {
  report: "not_started" | "pending" | "synced" | "failed";
  audio: "not_expected" | "pending" | "stored" | "failed";
  keepOriginalOnPhone: boolean;
};
export function callSyncState(input: {
  reportSubmittedAck: boolean;
  reportError?: boolean;
  audioExpected: boolean;
  expectedChecksum?: string | null;
  uploadAck?: { recording_id?: unknown; upload_status?: unknown; checksum?: unknown } | null;
  audioError?: boolean;
}): CallSyncState {
  const stored = Boolean(input.expectedChecksum && input.uploadAck && uploadConfirmed(input.uploadAck, input.expectedChecksum));
  const audio = !input.audioExpected ? "not_expected" : stored ? "stored" : input.audioError ? "failed" : "pending";
  const report = input.reportSubmittedAck ? "synced" : input.reportError ? "failed" : "pending";
  return { report, audio, keepOriginalOnPhone: input.audioExpected && !stored };
}

/** Idempotent merge keyed only by call UID. Replays never duplicate; conflicts are flagged, never overwritten. */
export type CallEvidence = {
  callUid: string;
  source: "android_report" | "recording_upload" | "crm_record";
  agentId: string;
  leadId: string;
  recordingId?: string | null;
  reportId?: string | null;
  checksum?: string | null;
};
export type ReconciledCall = {
  callUid: string;
  agentId: string;
  leadId: string;
  recordingId: string | null;
  reportId: string | null;
  checksum: string | null;
  sources: CallEvidence["source"][];
  conflicts: ("agent" | "lead" | "recording" | "report" | "checksum")[];
};
export function reconcileCalls(evidence: readonly CallEvidence[]): ReconciledCall[] {
  const byUid = new Map<string, ReconciledCall>();
  for (const e of evidence) {
    const uid = e.callUid.trim();
    if (!uid) continue;
    const cur = byUid.get(uid);
    if (!cur) {
      byUid.set(uid, { callUid: uid, agentId: e.agentId, leadId: e.leadId, recordingId: e.recordingId ?? null, reportId: e.reportId ?? null, checksum: e.checksum ?? null, sources: [e.source], conflicts: [] });
      continue;
    }
    if (!cur.sources.includes(e.source)) cur.sources.push(e.source);
    const flag = (k: ReconciledCall["conflicts"][number]) => { if (!cur.conflicts.includes(k)) cur.conflicts.push(k); };
    if (e.agentId !== cur.agentId) flag("agent");
    if (e.leadId !== cur.leadId) flag("lead");
    for (const [k, field] of [["recording", "recordingId"], ["report", "reportId"], ["checksum", "checksum"]] as const) {
      const v = e[field] ?? null;
      if (!v) continue;
      if (!cur[field]) cur[field] = v;
      else if (cur[field] !== v) flag(k);
    }
  }
  return [...byUid.values()];
}
