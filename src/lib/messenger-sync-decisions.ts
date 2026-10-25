/**
 * Messenger sync enable/disable audit rules — browser-safe pure logic.
 *
 * Every enable/disable decision is recorded append-only with the staff
 * member, time, a verification snapshot and a reason. An enable decision is
 * refused unless every verification checklist track has a latest "verified"
 * outcome, so sync can never be switched on before approval verification.
 */
import {
  META_VERIFICATION_TRACKS,
  latestPerTrack,
  validateEvidenceNote,
  type MetaVerificationRecord,
  type MetaVerificationTrackId,
  type NoteValidation,
} from "@/lib/meta-verification";

export type SyncDecisionAction = "enable" | "disable";

export type MessengerSyncDecision = {
  id: string;
  action: SyncDecisionAction;
  actorLabel: string | null;
  verifiedTracks: MetaVerificationTrackId[];
  missingTracks: MetaVerificationTrackId[];
  reason: string;
  createdAt: string;
};

/** Reasons follow the same rule as evidence notes: never credential-like. */
export function validateDecisionReason(raw: string): NoteValidation {
  return validateEvidenceNote(raw);
}

export type SyncEnableEvaluation =
  | { ok: true; verifiedTracks: MetaVerificationTrackId[] }
  | { ok: false; code: "VERIFICATION_INCOMPLETE"; missingTracks: MetaVerificationTrackId[] };

/**
 * An enable decision is allowed only when every checklist track's latest
 * recorded outcome is "verified". Any missing or failed track blocks it.
 */
export function evaluateSyncEnable(records: MetaVerificationRecord[]): SyncEnableEvaluation {
  const latest = latestPerTrack(records);
  const verified: MetaVerificationTrackId[] = [];
  const missing: MetaVerificationTrackId[] = [];
  for (const track of META_VERIFICATION_TRACKS) {
    const record = latest.get(track.id);
    if (record && record.outcome === "verified") verified.push(track.id);
    else missing.push(track.id);
  }
  if (missing.length > 0) return { ok: false, code: "VERIFICATION_INCOMPLETE", missingTracks: missing };
  return { ok: true, verifiedTracks: verified };
}

/** Newest decision wins; ties keep the later array entry. */
export function latestSyncDecision(decisions: MessengerSyncDecision[]): MessengerSyncDecision | null {
  let latest: MessengerSyncDecision | null = null;
  for (const decision of decisions) {
    if (!latest || decision.createdAt >= latest.createdAt) latest = decision;
  }
  return latest;
}

/** The audit log alone never enables sync — it only records the decision. */
export function syncEnabledByDecisions(decisions: MessengerSyncDecision[]): boolean {
  return latestSyncDecision(decisions)?.action === "enable";
}
