import { describe, expect, it } from "vitest";
import { daysWaiting, latestResets, pendingResets } from "@/lib/pending-password-resets";

describe("pending password resets", () => {
  it("only lists accounts that still must set a new password", () => {
    const rows = [
      { profileId: "a", hasAccount: true, mustChangePassword: true, resetIssuedAt: "2026-10-26T08:00:00Z" },
      { profileId: "b", hasAccount: true, mustChangePassword: false, resetIssuedAt: "2026-10-20T08:00:00Z" },
      { profileId: "c", hasAccount: false, mustChangePassword: true, resetIssuedAt: null },
    ];
    expect(pendingResets(rows).map((r) => r.profileId)).toEqual(["a"]);
  });

  it("puts the oldest reset first and unknown times last", () => {
    const rows = [
      { profileId: "new", hasAccount: true, mustChangePassword: true, resetIssuedAt: "2026-10-26T08:00:00Z" },
      { profileId: "none", hasAccount: true, mustChangePassword: true, resetIssuedAt: null },
      { profileId: "old", hasAccount: true, mustChangePassword: true, resetIssuedAt: "2026-10-20T08:00:00Z" },
    ];
    expect(pendingResets(rows).map((r) => r.profileId)).toEqual(["old", "new", "none"]);
  });

  it("uses the latest reset, counting IT-set passwords but not other account edits", () => {
    const m = latestResets([
      { entity_id: "p", action: "agent_password_reset_link_issued", created_at: "2026-10-20T00:00:00Z", metadata: {} },
      { entity_id: "p", action: "agent_account_updated", created_at: "2026-10-25T00:00:00Z", metadata: { passwordChanged: true } },
      { entity_id: "p", action: "agent_account_updated", created_at: "2026-10-26T00:00:00Z", metadata: { passwordChanged: false } },
    ]);
    expect(m.get("p")).toEqual({ at: "2026-10-25T00:00:00Z", kind: "it_password" });
  });

  it("counts whole days waiting", () => {
    expect(daysWaiting("2026-10-24T10:00:00Z", new Date("2026-10-27T09:00:00Z"))).toBe(2);
    expect(daysWaiting(null, new Date())).toBeNull();
  });
});
