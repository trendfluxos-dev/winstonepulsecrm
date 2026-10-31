import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isPhoneMeasuredCall } from "@/lib/call-duration";

const src = readFileSync("src/routes/api/public/agent/call-state.ts", "utf8");

describe("live call-state pushes are never phone-measured", () => {
  it("labels inserted rows as the live dialer, not android_sim", () => {
    expect(src).toContain('call_source: "android_dialer"');
    expect(src).not.toContain('call_source: "android_sim"');
  });
  it("rejects the reserved call-log id prefix", () => {
    expect(src).toMatch(/startsWith\("log-"\)/);
  });
  it("such a row cannot verify a connection", () => {
    expect(isPhoneMeasuredCall({ call_source: "android_dialer", external_call_id: "uid-123456" })).toBe(false);
  });
  it("keeps phone-measured duration from being overwritten", () => {
    expect(src).toContain("isPhoneMeasuredCall(existing) ? withoutDuration");
  });
});
