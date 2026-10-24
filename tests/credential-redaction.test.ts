import { describe, expect, it } from "vitest";
import { redactCredentialText } from "@/lib/credential-redaction";

describe("local credential redaction", () => {
  it("drops complete sensitive label lines", () => {
    for (const label of ["access_token", "Page ID", "password", "App Secret", "পাসওয়ার্ড", "টোকেন", "Authorization"]) {
      expect(redactCredentialText(`${label}: synthetic-value`)).toBe("[REDACTED]");
    }
  });
  it("redacts values on the next nonempty line conservatively", () => {
    expect(redactCredentialText("Password:\n\nsynthetic-value\nPublic note")).toBe("[REDACTED]\n\n[REDACTED]\nPublic note");
  });
  it("masks unlabeled token-like values and long numeric IDs", () => {
    expect(redactCredentialText("EAAunitTestTokenOnly\n123456789012345\nabcdefghijklmnopqrstuvwxyz12345")).toBe("[REDACTED]\n[REDACTED]\n[REDACTED]");
  });
  it("masks query strings and JSON credential lines without preserving suffixes", () => {
    expect(redactCredentialText('https://example.test/?access_token=synthetic\n{"password":"synthetic"}')).toBe("[REDACTED]\n[REDACTED]");
  });
  it("keeps ordinary text and normalizes CRLF", () => {
    expect(redactCredentialText("Public note\r\nDone")).toBe("Public note\nDone");
  });
});