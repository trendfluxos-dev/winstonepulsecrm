/**
 * Android sync failures reported by Winstone Connect (2.22+), stored as
 * sync_events rows (event_type "android_sync_failure", status "failed").
 *
 * Pure and browser-safe: error kinds mirror the app's SyncErrorClassifier,
 * plus the recording-binding refusals. Only technical fields are kept — never
 * phone numbers, names, audio, server message text or tokens; the call is a
 * one-way fingerprint.
 */
import { formatDhaka } from "@/lib/load-diagnostics";

export const SYNC_FAILURE_EVENT = "android_sync_failure";

export const SYNC_ERROR_KINDS = [
  "NETWORK",
  "SERVER_BUSY",
  "SERVER_ERROR",
  "SIGN_IN_REQUIRED",
  "BRIEFING_REQUIRED",
  "ACCESS_DENIED",
  "NOT_FOUND",
  "CONFLICT",
  "INVALID_DATA",
  "APP_UPDATE_REQUIRED",
  "RECORDING_OWNER_MISMATCH",
  "RECORDING_CONSENT_INACTIVE",
  "RECORDING_AMBIGUOUS",
  "UNKNOWN",
] as const;
export type SyncErrorKind = (typeof SYNC_ERROR_KINDS)[number];

export const SYNC_ITEM_KINDS = [
  "recording",
  "call_state",
  "incoming_call",
  "report_open",
  "report_submit",
  "lead_submit",
  "outcome",
  "recording_pickup",
  "other",
] as const;
export type SyncItemKind = (typeof SYNC_ITEM_KINDS)[number];

export const ITEM_LABEL: Record<SyncItemKind, string> = {
  recording: "Recording upload",
  call_state: "Call status (app-dialled)",
  incoming_call: "Call status (incoming / phone dialer)",
  report_open: "Report opening",
  report_submit: "Report submission",
  lead_submit: "New lead",
  outcome: "Call outcome",
  recording_pickup: "Phone recorder pickup",
  other: "Other",
};

/** What the error means and what an admin should do next (bilingual, short). */
export const NEXT_STEP: Record<SyncErrorKind, { label: string; permanent: boolean; step: string }> = {
  NETWORK: { label: "No internet on the phone", permanent: false,
    step: "No action if it clears. If it lasts over a day, check the agent's mobile data / Wi-Fi. / একদিনের বেশি থাকলে এজেন্টের ইন্টারনেট দেখুন।" },
  SERVER_BUSY: { label: "CRM busy (rate limited)", permanent: false,
    step: "Retries automatically. If many agents show it at once, check CRM load at that time. / অনেক এজেন্টের হলে সার্ভার লোড দেখুন।" },
  SERVER_ERROR: { label: "CRM server error", permanent: false,
    step: "Retries automatically. Check CRM server logs at the time shown and report to the developer if repeating. / একই সময়ের সার্ভার লগ দেখুন।" },
  SIGN_IN_REQUIRED: { label: "Phone sign-in expired", permanent: false,
    step: "Ask the agent to sign in again in the app; confirm the device is not revoked in the IT Console. / এজেন্টকে আবার সাইন ইন করতে বলুন।" },
  BRIEFING_REQUIRED: { label: "9:05 briefing not accepted", permanent: false,
    step: "Ask the agent to accept today's 9:05 briefing; waiting work then sends. / আজকের ব্রিফিং স্বীকার করতে বলুন।" },
  ACCESS_DENIED: { label: "Lead not assigned to this agent", permanent: true,
    step: "Check the lead's current owner and transfers. If the agent should own it, fix it through LeadHub; otherwise no action. / LeadHub-এ মালিকানা দেখুন।" },
  NOT_FOUND: { label: "Lead not found in CRM", permanent: true,
    step: "Check whether the lead was parked as duplicate or archived; tell the agent which lead to use. / লিডটি ডুপ্লিকেট/আর্কাইভ কিনা দেখুন।" },
  CONFLICT: { label: "Call already saved for another lead/agent", permanent: true,
    step: "IT reviews the call record for that call reference. Do not ask the agent to resend. / কল রেকর্ড আইটি যাচাই করবে।" },
  INVALID_DATA: { label: "CRM rejected the data", permanent: true,
    step: "Check the phone's app version; ask the agent to re-enter the report. Escalate to the developer if it repeats on the latest app. / অ্যাপ সংস্করণ দেখুন, রিপোর্ট আবার পূরণ করান।" },
  APP_UPDATE_REQUIRED: { label: "Old app version refused", permanent: true,
    step: "Install the latest approved APK on this phone. / ফোনে সর্বশেষ অনুমোদিত অ্যাপ ইনস্টল করুন।" },
  RECORDING_OWNER_MISMATCH: { label: "Recording belongs to another agent / no call ID", permanent: true,
    step: "Expected after a phone was shared or signed into by someone else. Audio stays on the phone; IT decides whether it belongs to a call. / অডিও ফোনে আছে — আইটি সিদ্ধান্ত নেবে।" },
  RECORDING_CONSENT_INACTIVE: { label: "Recording consent not active", permanent: true,
    step: "No upload without consent. If the agent should record, they re-accept recording consent in the app. / সম্মতি ছাড়া আপলোড হবে না।" },
  RECORDING_AMBIGUOUS: { label: "Several recordings matched one call", permanent: true,
    step: "Nothing was uploaded to avoid the wrong audio. No action needed; check the phone recorder's file naming if it repeats. / ভুল অডিও এড়াতে কিছু পাঠানো হয়নি।" },
  UNKNOWN: { label: "Unclassified failure", permanent: false,
    step: "Check the phone's sync screen for the message; escalate if it repeats. / ফোনের সিঙ্ক স্ক্রিন দেখুন।" },
};

export type SyncFailureRow = {
  id: string;
  agent_id: string | null;
  device_id: string | null;
  created_at: string;
  payload: unknown;
};

export type SyncFailureEvent = {
  id: string;
  agentId: string | null;
  agentName: string;
  deviceId: string | null;
  appVersion: string;
  errorKind: SyncErrorKind;
  itemKind: SyncItemKind;
  httpStatus: number | null;
  attempts: number;
  count: number;
  permanent: boolean;
  callRef: string | null;
  firstAtUtc: string | null;
  lastAtUtc: string;
  receivedAtUtc: string;
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : null;
const iso = (v: unknown): string | null =>
  typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;

/** Maps one stored row to a safe DTO; unknown or missing values stay explicit. */
export function toSyncFailureEvent(row: SyncFailureRow, names: Map<string, string>, versions: Map<string, string>): SyncFailureEvent {
  const p = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<string, unknown>;
  const errorKind = pick(p.error_kind, SYNC_ERROR_KINDS, "UNKNOWN");
  const lastAt = iso(p.last_at) ?? row.created_at;
  const callRef = typeof p.call_ref === "string" && /^[a-f0-9]{12}$/.test(p.call_ref) ? p.call_ref : null;
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: (row.agent_id && names.get(row.agent_id)) || "Unknown agent",
    deviceId: row.device_id,
    appVersion: (row.device_id && versions.get(row.device_id)) || "Unknown",
    errorKind,
    itemKind: pick(p.item_kind, SYNC_ITEM_KINDS, "other"),
    httpStatus: int(p.http_status, 0, 599),
    attempts: int(p.attempts, 0, 9999) ?? 0,
    count: Math.max(1, int(p.count, 1, 9999) ?? 1),
    permanent: typeof p.permanent === "boolean" ? p.permanent : NEXT_STEP[errorKind].permanent,
    callRef,
    firstAtUtc: iso(p.first_at),
    lastAtUtc: lastAt,
    receivedAtUtc: row.created_at,
  };
}

export type KindSummary = { kind: SyncErrorKind; label: string; failures: number; agents: number; permanent: boolean; lastAtUtc: string; step: string };
export type AgentSummary = { agentId: string | null; agentName: string; failures: number; permanent: number; topKind: SyncErrorKind; lastAtUtc: string; appVersion: string; step: string };

export function summarizeSyncFailures(events: SyncFailureEvent[]) {
  const byKind = new Map<SyncErrorKind, SyncFailureEvent[]>();
  const byAgent = new Map<string, SyncFailureEvent[]>();
  for (const e of events) {
    byKind.set(e.errorKind, [...(byKind.get(e.errorKind) ?? []), e]);
    const key = e.agentId ?? "unknown";
    byAgent.set(key, [...(byAgent.get(key) ?? []), e]);
  }
  const latest = (list: SyncFailureEvent[]) => list.reduce((m, e) => (e.lastAtUtc > m ? e.lastAtUtc : m), list[0]!.lastAtUtc);
  const total = (list: SyncFailureEvent[]) => list.reduce((n, e) => n + e.count, 0);

  const kinds: KindSummary[] = [...byKind.entries()].map(([kind, list]) => ({
    kind,
    label: NEXT_STEP[kind].label,
    failures: total(list),
    agents: new Set(list.map((e) => e.agentId ?? "unknown")).size,
    permanent: NEXT_STEP[kind].permanent,
    lastAtUtc: latest(list),
    step: NEXT_STEP[kind].step,
  })).sort((a, b) => b.failures - a.failures || b.lastAtUtc.localeCompare(a.lastAtUtc));

  const agents: AgentSummary[] = [...byAgent.values()].map((list) => {
    const counts = new Map<SyncErrorKind, number>();
    for (const e of list) counts.set(e.errorKind, (counts.get(e.errorKind) ?? 0) + e.count);
    // Permanent problems need people; they rank above retryable ones of equal count.
    const topKind = [...counts.entries()].sort((a, b) =>
      b[1] - a[1] || Number(NEXT_STEP[b[0]].permanent) - Number(NEXT_STEP[a[0]].permanent))[0]![0];
    const newest = list.reduce((m, e) => (e.lastAtUtc > m.lastAtUtc ? e : m), list[0]!);
    return {
      agentId: list[0]!.agentId,
      agentName: list[0]!.agentName,
      failures: total(list),
      permanent: total(list.filter((e) => e.permanent)),
      topKind,
      lastAtUtc: newest.lastAtUtc,
      appVersion: newest.appVersion,
      step: NEXT_STEP[topKind].step,
    };
  }).sort((a, b) => b.permanent - a.permanent || b.failures - a.failures);

  return {
    failures: total(events),
    permanent: total(events.filter((e) => e.permanent)),
    agentsAffected: byAgent.size,
    kinds,
    agents,
    latest: [...events].sort((a, b) => b.lastAtUtc.localeCompare(a.lastAtUtc)).slice(0, 100),
  };
}

export { formatDhaka };
