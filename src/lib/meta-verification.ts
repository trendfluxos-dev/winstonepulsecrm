/**
 * Safe Meta verification checklist shared by the /inbox UI and the server
 * functions. Evidence notes are validated here so an access token can never
 * be stored as "evidence": any note that changes under credential redaction
 * is rejected before it reaches the database.
 */
import { redactCredentialText } from "@/lib/credential-redaction";

export const META_VERIFICATION_TRACKS = [
  {
    id: "app_review",
    label: { bn: "App Review · pages_messaging", en: "App Review · pages_messaging" },
    hint: { bn: "যেমন: App Review স্ক্রিনে pages_messaging-এর পাশে 'Approved' দেখা গেছে", en: "e.g. App Review screen shows 'Approved' beside pages_messaging" },
  },
  {
    id: "live_mode",
    label: { bn: "App Live mode", en: "App Live mode" },
    hint: { bn: "যেমন: ড্যাশবোর্ডের উপরে App mode: Live সবুজ সুইচ চালু", en: "e.g. dashboard top shows the App mode: Live switch on" },
  },
  {
    id: "page_consent",
    label: { bn: "Page messaging সম্মতি", en: "Page messaging consent" },
    hint: { bn: "যেমন: Messenger → API Setup-এ Page যুক্ত ও Generate token সম্পন্ন", en: "e.g. Messenger → API Setup shows the Page linked and token generated" },
  },
  {
    id: "messages_subscription",
    label: { bn: "messages subscription (App + Page)", en: "messages subscription (App + Page)" },
    hint: { bn: "যেমন: Webhooks → Page-এ messages ফিল্ড subscribed দেখা গেছে", en: "e.g. Webhooks → Page shows the messages field subscribed" },
  },
] as const;

export type MetaVerificationTrackId = (typeof META_VERIFICATION_TRACKS)[number]["id"];
export type MetaVerificationOutcome = "verified" | "failed";

export type MetaVerificationRecord = {
  id: string;
  track: MetaVerificationTrackId;
  outcome: MetaVerificationOutcome;
  note: string;
  actorLabel: string | null;
  createdAt: string;
};

export type NoteValidation = { ok: true; note: string } | { ok: false; code: "NOTE_TOO_SHORT" | "NOTE_TOO_LONG" | "NOTE_CONTAINS_CREDENTIAL" };

/** A note is evidence text only; anything credential-like is refused. */
export function validateEvidenceNote(raw: string): NoteValidation {
  const note = raw.trim();
  if (note.length < 10) return { ok: false, code: "NOTE_TOO_SHORT" };
  if (note.length > 500) return { ok: false, code: "NOTE_TOO_LONG" };
  if (redactCredentialText(note) !== note) return { ok: false, code: "NOTE_CONTAINS_CREDENTIAL" };
  return { ok: true, note };
}

/** Latest record per track, preserving the fixed track order. */
export function latestPerTrack(records: MetaVerificationRecord[]): Map<MetaVerificationTrackId, MetaVerificationRecord> {
  const latest = new Map<MetaVerificationTrackId, MetaVerificationRecord>();
  for (const record of records) {
    const current = latest.get(record.track);
    if (!current || record.createdAt > current.createdAt) latest.set(record.track, record);
  }
  return latest;
}
