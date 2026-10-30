import { describe, expect, it } from "vitest";
import { checksumMatches, sha256Hex } from "@/lib/checksum";
describe("APK checksum verification", () => {
  it("hashes known input", async () => expect(await sha256Hex(new TextEncoder().encode("abc").buffer as ArrayBuffer)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
  it("matches identical digests ignoring case", () => expect(checksumMatches("ab".repeat(32), "AB".repeat(32))).toBe(true));
  it("rejects a different digest", () => expect(checksumMatches("ab".repeat(32), "cd".repeat(32))).toBe(false));
  it("rejects a malformed expected value", () => expect(checksumMatches("", "")).toBe(false));
});
