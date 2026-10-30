import { describe, expect, it } from "vitest";
import { diffAccess, mergeSnapshot, type AccessSnapshot } from "@/lib/github-access";

const ready = (key: string, login = "trendfluxos-dev", canPush: boolean | null = true): AccessSnapshot => ({ key, login, verdict: "ready", canPush });

describe("GitHub access watch", () => {
  it("alerts when access is revoked", () => {
    expect(diffAccess([ready("A")], [{ key: "A", login: "trendfluxos-dev", verdict: "no_access", canPush: null }]).map((c) => c.kind)).toEqual(["revoked"]);
  });
  it("alerts when write permission is removed", () => {
    expect(diffAccess([ready("A")], [ready("A", "trendfluxos-dev", false)]).map((c) => c.kind)).toEqual(["write_lost"]);
  });
  it("alerts when a connection disappears or its account changes", () => {
    expect(diffAccess([ready("A"), ready("B", "x")], [ready("B", "y")]).map((c) => c.kind)).toEqual(["connection_removed", "account_changed"]);
  });
  it("never treats a failed check as a revocation and keeps the last known state", () => {
    const failed: AccessSnapshot = { key: "A", login: null, verdict: "check_failed", canPush: null };
    expect(diffAccess([ready("A")], [failed])).toEqual([]);
    expect(mergeSnapshot([ready("A")], [failed])).toEqual([ready("A")]);
  });
  it("is silent when nothing changed", () => {
    expect(diffAccess([ready("A")], [ready("A")])).toEqual([]);
  });
});
