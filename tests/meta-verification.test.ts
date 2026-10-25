import { describe, expect, it } from "vitest";

import { META_VERIFICATION_TRACKS, latestPerTrack, validateEvidenceNote } from "@/lib/meta-verification";

describe("meta verification checklist", () => {
  it("covers exactly the four evidence tracks in a fixed order", () => {
    expect(META_VERIFICATION_TRACKS.map((track) => track.id)).toEqual([
      "app_review",
      "live_mode",
      "page_consent",
      "messages_subscription",
    ]);
    for (const track of META_VERIFICATION_TRACKS) {
      expect(track.label.bn.length).toBeGreaterThan(0);
      expect(track.hint.en.length).toBeGreaterThan(0);
    }
  });

  it("accepts a plain evidence note", () => {
    const result = validateEvidenceNote("App Review স্ক্রিনে pages_messaging-এর পাশে Approved দেখা গেছে");
    expect(result.ok).toBe(true);
  });

  it("rejects notes that contain credential-like material", () => {
    expect(validateEvidenceNote("access token: EAAabc123def456ghi789jkl012").ok).toBe(false);
    expect(validateEvidenceNote("token হলো EAAxYz1234567890abcdef").ok).toBe(false);
    expect(validateEvidenceNote("page id 1381455345040362 দিয়ে চেক করেছি").ok).toBe(false);
    const refused = validateEvidenceNote("app secret = 0123456789abcdef0123456789abcdef");
    expect(refused).toEqual({ ok: false, code: "NOTE_CONTAINS_CREDENTIAL" });
  });

  it("enforces note length bounds", () => {
    expect(validateEvidenceNote("ছোট").ok).toBe(false);
    expect(validateEvidenceNote("x".repeat(501)).ok).toBe(false);
  });

  it("keeps the latest record per track", () => {
    const records = [
      { id: "1", track: "app_review" as const, outcome: "failed" as const, note: "a", actorLabel: null, createdAt: "2026-10-25T01:00:00Z" },
      { id: "2", track: "app_review" as const, outcome: "verified" as const, note: "b", actorLabel: null, createdAt: "2026-10-25T02:00:00Z" },
      { id: "3", track: "live_mode" as const, outcome: "verified" as const, note: "c", actorLabel: null, createdAt: "2026-10-25T01:30:00Z" },
    ];
    const latest = latestPerTrack(records);
    expect(latest.get("app_review")?.id).toBe("2");
    expect(latest.get("live_mode")?.id).toBe("3");
    expect(latest.get("page_consent")).toBeUndefined();
  });
});
