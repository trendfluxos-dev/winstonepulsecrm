import { describe, expect, it } from "vitest";

import { metaVerificationReport } from "@/lib/meta-verification-report";

describe("meta verification report", () => {
  it("reports the three evidence tracks separately", () => {
    const report = metaVerificationReport();
    expect(report.generatedFrom).toBe("preparation_only");
    expect(report.tracks.map((track) => track.id)).toEqual([
      "app_approval",
      "page_subscription",
      "token_revocation",
    ]);
  });

  it("never invents a verification timestamp or a verified status", () => {
    const report = metaVerificationReport();
    for (const track of report.tracks) {
      expect(track.status).toBe("unverified");
      expect(track.checkedAt).toBeNull();
    }
  });

  it("keeps token revocation distinct from approval evidence", () => {
    const report = metaVerificationReport();
    const revocation = report.tracks.find((track) => track.id === "token_revocation")!;
    const approval = report.tracks.find((track) => track.id === "app_approval")!;
    expect(revocation.evidence.en).not.toBe(approval.evidence.en);
    expect(revocation.blocker.en).toContain("revoke");
  });

  it("carries bilingual labels, evidence and blockers", () => {
    const report = metaVerificationReport();
    for (const track of report.tracks) {
      expect(track.label.bn.length).toBeGreaterThan(0);
      expect(track.label.en.length).toBeGreaterThan(0);
      expect(track.evidence.bn.length).toBeGreaterThan(0);
      expect(track.blocker.bn.length).toBeGreaterThan(0);
    }
  });
});
