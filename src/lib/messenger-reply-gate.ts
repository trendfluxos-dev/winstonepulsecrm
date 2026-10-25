/**
 * Guarded Messenger reply gate — pure, browser-safe rules. A reply may only
 * be attempted when EVERY blocker is cleared: the server secrets exist, all
 * four Meta verification tracks are verified, the audited sync decision is
 * "enable", and a staff member explicitly confirmed this send. Until then the
 * path refuses and nothing is sent or written to the outbox.
 */

export type ReplyBlockerId =
  | "app_secret"
  | "page_token"
  | "page_id"
  | "verification"
  | "sync_disabled"
  | "no_staff_confirm";

export const REPLY_BLOCKERS: Record<ReplyBlockerId, { bn: string; en: string }> = {
  app_secret: { bn: "META_APP_SECRET সংরক্ষিত নেই", en: "META_APP_SECRET is not stored" },
  page_token: { bn: "Page access token সংরক্ষিত নেই", en: "Page access token is not stored" },
  page_id: { bn: "Page ID সংরক্ষিত নেই", en: "Page ID is not stored" },
  verification: { bn: "Meta যাচাইয়ের চারটি track এখনও verified নয়", en: "Not all four Meta verification tracks are verified" },
  sync_disabled: { bn: "অডিট-সিদ্ধান্তে sync enable নেই", en: "No audited sync enable decision" },
  no_staff_confirm: { bn: "কর্মীর স্পষ্ট অনুমতি নেই", en: "No explicit staff confirmation" },
};

export type ReplyGateInput = {
  appSecretConfigured: boolean;
  pageTokenConfigured: boolean;
  pageIdConfigured: boolean;
  allTracksVerified: boolean;
  syncEnabled: boolean;
  staffConfirmed: boolean;
};

export type ReplyGateResult = { ok: true } | { ok: false; blockers: ReplyBlockerId[] };

/** Every condition must pass; the blocker list is safe to show staff. */
export function evaluateReplyGate(input: ReplyGateInput): ReplyGateResult {
  const blockers: ReplyBlockerId[] = [];
  if (!input.appSecretConfigured) blockers.push("app_secret");
  if (!input.pageTokenConfigured) blockers.push("page_token");
  if (!input.pageIdConfigured) blockers.push("page_id");
  if (!input.allTracksVerified) blockers.push("verification");
  if (!input.syncEnabled) blockers.push("sync_disabled");
  if (!input.staffConfirmed) blockers.push("no_staff_confirm");
  return blockers.length ? { ok: false, blockers } : { ok: true };
}
