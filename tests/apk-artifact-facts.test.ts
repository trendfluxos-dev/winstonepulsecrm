import { describe, expect, it } from "vitest";
import { parseApkVersion, parseSha256 } from "@/lib/github-status.server";
describe("APK download facts", () => {
  it("reads version name and code", () => expect(parseApkVersion('versionCode = 28\n versionName = "2.17"')).toBe("2.17 (28)"));
  it("unknown version stays null", () => expect(parseApkVersion(null)).toBeNull());
  it("accepts only real sha256 digests", () => {
    expect(parseSha256("sha256:" + "A".repeat(64))).toBe("a".repeat(64));
    expect(parseSha256("sha1:abc")).toBeNull();
    expect(parseSha256(undefined)).toBeNull();
  });
});
