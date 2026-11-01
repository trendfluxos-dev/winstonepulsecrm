/**
 * When a phone outcome may mark a lead as verified.
 *
 * The phone's own "connected" flag is never enough. A lead becomes verified
 * only when the CRM already holds this agent's call record for the same call
 * (same call_uid, same lead), the call completed, it has real talk time, and
 * that time was proven by the phone (see hasProvenTalkTime). Anything
 * missing or incomplete leaves the lead unverified — fail closed.
 */
import { isPhoneMeasuredCall } from "@/lib/call-duration";

export type CallEvidenceRow = {
  agent_id?: string | null;
  lead_id?: string | null;
  call_status?: string | null;
  duration_seconds?: number | null;
  call_source?: string | null;
  external_call_id?: string | null;
  /** "call_log" only when the phone proved talk time from Android's call history. */
  talk_time_source?: string | null;
};

/**
 * Talk time that can prove a conversation for lead verification.
 * App-dialled calls (android_sim) from app 2.21 sent dial-to-hang-up time, which
 * includes ringing, so their duration is trusted only when the phone marked it
 * as call-history evidence (talk_time_source = "call_log"). Phone-dialer calls
 * count with that mark or a call-log row id; other sources follow isPhoneMeasuredCall.
 */
export function hasProvenTalkTime(row: CallEvidenceRow): boolean {
  const source = String(row.call_source ?? "");
  const fromCallLog = row.talk_time_source === "call_log";
  if (source === "android_sim") return fromCallLog;
  if (source === "android_dialer" && fromCallLog) return true;
  return isPhoneMeasuredCall(row);
}

export type VerificationReason =
  | "verified"
  | "no_call_id"
  | "no_call_record"
  | "other_agent"
  | "other_lead"
  | "call_not_completed"
  | "no_talk_time"
  | "not_phone_measured";

export type VerificationResult = { verified: boolean; reason: VerificationReason };

export function verifyLeadFromCallEvidence(input: {
  callUid?: string | null;
  row: CallEvidenceRow | null | undefined;
  agentId: string;
  leadId: string;
}): VerificationResult {
  const no = (reason: VerificationReason): VerificationResult => ({ verified: false, reason });
  if (!input.callUid) return no("no_call_id");
  const row = input.row;
  if (!row || row.external_call_id !== input.callUid) return no("no_call_record");
  if (row.agent_id !== input.agentId) return no("other_agent");
  if (row.lead_id !== input.leadId) return no("other_lead");
  if (row.call_status !== "completed") return no("call_not_completed");
  const seconds = row.duration_seconds;
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return no("no_talk_time");
  if (!hasProvenTalkTime(row)) return no("not_phone_measured");
  return { verified: true, reason: "verified" };
}
