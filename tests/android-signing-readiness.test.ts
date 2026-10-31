import { describe, expect, it } from "vitest";
import {
  classifySigningReadiness,
  REQUIRED_SIGNING_SECRETS,
} from "@/lib/android-signing-readiness";

const ALL = [...REQUIRED_SIGNING_SECRETS];

describe("live Android signing readiness", () => {
  it("is ready only with all four secrets and the company fingerprint", () => {
    expect(classifySigningReadiness(ALL, ["WINSTONE_RELEASE_CERT_SHA256"]).verdict).toBe("ready");
  });

  it("blocks when the repository has no signing settings (current state)", () => {
    const r = classifySigningReadiness([], []);
    expect(r.verdict).toBe("blocked");
    expect(r.missingSecrets).toEqual(ALL);
    expect(r.fingerprintRecorded).toBe(false);
  });

  it("blocks when all secrets exist but the trusted fingerprint is missing", () => {
    expect(classifySigningReadiness(ALL, ["WINSTONE_TEST_CERT_SHA256"]).verdict).toBe("blocked");
  });

  it("blocks and names the one missing secret", () => {
    const r = classifySigningReadiness(
      ALL.filter((n) => n !== "WINSTONE_KEY_PASSWORD"),
      ["WINSTONE_RELEASE_CERT_SHA256"],
    );
    expect(r.verdict).toBe("blocked");
    expect(r.missingSecrets).toEqual(["WINSTONE_KEY_PASSWORD"]);
  });

  it("never reports missing or ready when GitHub could not be read", () => {
    expect(classifySigningReadiness(null, [])).toEqual({
      verdict: "check_failed",
      missingSecrets: [],
      fingerprintRecorded: null,
    });
    expect(classifySigningReadiness(ALL, null).verdict).toBe("check_failed");
  });
});
