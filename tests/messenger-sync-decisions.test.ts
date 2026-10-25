import { describe, expect, it } from "vitest";

import { META_VERIFICATION_TRACKS, type MetaVerificationRecord } from "@/lib/meta-verification";
import {
  evaluateSyncEnable,
  latestSyncDecision,
  syncEnabledByDecisions,
  validateDecisionReason,
  type MessengerSyncDecision,
} from "@/lib/messenger-sync-decisions";

const record = (track: string, outcome: "verified" | "failed", createdAt: string): MetaVerificationRecord => ({
  id: `${track}-${createdAt}`,
  track: track as MetaVerificationRecord["track"],
  outcome,
  note: "স্ক্রিনে অনুমোদন দেখা গেছে",
  actorLabel: "IT কর্মী",
  createdAt,
});

const allVerified = (): MetaVerificationRecord[] =>
  META_VERIFICATION_TRACKS.map((track, index) => record(track.id, "verified", `2026-10-25T0${index}:00:00Z`));

describe("evaluateSyncEnable", () => {
  it("refuses enable when no evidence exists at all", () => {
    const result = evaluateSyncEnable([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VERIFICATION_INCOMPLETE");
      expect(result.missingTracks).toHaveLength(META_VERIFICATION_TRACKS.length);
    }
  });

  it("refuses enable when any single track is unverified", () => {
    const records = allVerified().filter((item) => item.track !== "messages_subscription");
    const result = evaluateSyncEnable(records);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missingTracks).toEqual(["messages_subscription"]);
  });

  it("refuses enable when a track's latest outcome is failed", () => {
    const records = [
      ...allVerified(),
      record("live_mode", "failed", "2026-10-25T09:00:00Z"),
    ];
    const result = evaluateSyncEnable(records);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missingTracks).toEqual(["live_mode"]);
  });

  it("honours a later verified record over an earlier failed one", () => {
    const records = [
      ...allVerified(),
      record("live_mode", "failed", "2026-10-25T08:00:00Z"),
      record("live_mode", "verified", "2026-10-25T10:00:00Z"),
    ];
    const result = evaluateSyncEnable(records);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.verifiedTracks).toHaveLength(META_VERIFICATION_TRACKS.length);
  });

  it("allows enable only when every track's latest outcome is verified", () => {
    const result = evaluateSyncEnable(allVerified());
    expect(result.ok).toBe(true);
  });
});

describe("validateDecisionReason", () => {
  it("rejects short, long and credential-like reasons", () => {
    expect(validateDecisionReason("ছোট").ok).toBe(false);
    expect(validateDecisionReason("x".repeat(501)).ok).toBe(false);
    const withToken = validateDecisionReason("সিঙ্ক চালু করলাম, token: EAAG1234567890abcdef");
    expect(withToken.ok).toBe(false);
    if (!withToken.ok) expect(withToken.code).toBe("NOTE_CONTAINS_CREDENTIAL");
  });

  it("accepts a plain Bengali reason", () => {
    const result = validateDecisionReason("চারটি যাচাই সম্পন্ন হওয়ায় সিঙ্ক চালু করলাম");
    expect(result.ok).toBe(true);
  });
});

describe("latestSyncDecision / syncEnabledByDecisions", () => {
  const decision = (action: "enable" | "disable", createdAt: string): MessengerSyncDecision => ({
    id: `${action}-${createdAt}`,
    action,
    actorLabel: "IT কর্মী",
    verifiedTracks: [],
    missingTracks: [],
    reason: "কারণ লেখা আছে এখানে",
    createdAt,
  });

  it("returns null for an empty log and treats sync as off", () => {
    expect(latestSyncDecision([])).toBeNull();
    expect(syncEnabledByDecisions([])).toBe(false);
  });

  it("the newest decision wins", () => {
    const decisions = [
      decision("enable", "2026-10-25T01:00:00Z"),
      decision("disable", "2026-10-25T02:00:00Z"),
    ];
    expect(latestSyncDecision(decisions)?.action).toBe("disable");
    expect(syncEnabledByDecisions(decisions)).toBe(false);
  });

  it("reports on only when the newest decision is enable", () => {
    const decisions = [
      decision("disable", "2026-10-25T01:00:00Z"),
      decision("enable", "2026-10-25T03:00:00Z"),
    ];
    expect(syncEnabledByDecisions(decisions)).toBe(true);
  });
});
