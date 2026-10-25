/**
 * Credential-incident tracker — pure, browser-safe rules. Records the STATUS
 * of an exposed credential (exposed → revoked → replaced → verified active)
 * without ever storing the credential itself: any note that changes under
 * credential redaction is rejected before it reaches the database.
 */
import { redactCredentialText } from "@/lib/credential-redaction";

export const CREDENTIAL_SERVICES = [
  { id: "meta_page_token", label: { bn: "Meta Page access token", en: "Meta Page access token" } },
  { id: "meta_app_secret", label: { bn: "Meta App Secret", en: "Meta App Secret" } },
  { id: "meta_verify_token", label: { bn: "Webhook verify token", en: "Webhook verify token" } },
  { id: "model_api_key", label: { bn: "AI মডেল API key", en: "AI model API key" } },
  { id: "other", label: { bn: "অন্যান্য credential", en: "Other credential" } },
] as const;

export type CredentialServiceId = (typeof CREDENTIAL_SERVICES)[number]["id"];

export const CREDENTIAL_INCIDENT_STATUSES = [
  { id: "exposed", label: { bn: "উন্মুক্ত হয়েছে", en: "Exposed" } },
  { id: "revoked", label: { bn: "বাতিল করা হয়েছে", en: "Revoked" } },
  { id: "replaced", label: { bn: "প্রতিস্থাপিত", en: "Replaced" } },
  { id: "verified_active", label: { bn: "সক্রিয় যাচাইকৃত", en: "Verified active" } },
] as const;

export type CredentialIncidentStatus = (typeof CREDENTIAL_INCIDENT_STATUSES)[number]["id"];

export type CredentialIncident = {
  id: string;
  service: CredentialServiceId;
  status: CredentialIncidentStatus;
  note: string;
  actorLabel: string | null;
  createdAt: string;
};

export type IncidentNoteValidation =
  | { ok: true; note: string }
  | { ok: false; code: "NOTE_TOO_SHORT" | "NOTE_TOO_LONG" | "NOTE_CONTAINS_CREDENTIAL" };

/** A note is status text only; anything credential-like is refused. */
export function validateIncidentNote(raw: string): IncidentNoteValidation {
  const note = raw.trim();
  if (note.length < 10) return { ok: false, code: "NOTE_TOO_SHORT" };
  if (note.length > 500) return { ok: false, code: "NOTE_TOO_LONG" };
  if (redactCredentialText(note) !== note) return { ok: false, code: "NOTE_CONTAINS_CREDENTIAL" };
  return { ok: true, note };
}

/** Latest record per service, preserving the fixed service order. */
export function latestPerService(records: CredentialIncident[]): Map<CredentialServiceId, CredentialIncident> {
  const latest = new Map<CredentialServiceId, CredentialIncident>();
  for (const record of records) {
    const current = latest.get(record.service);
    if (!current || record.createdAt > current.createdAt) latest.set(record.service, record);
  }
  return latest;
}
