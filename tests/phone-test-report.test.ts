import { describe, it, expect } from "vitest";
import { PhoneTestReportSchema, failedCount } from "@/lib/phone-test-report";
const pass = { install: "pass", signin: "pass", call_detected: "pass", recording_upload: "pass", rejection_report: "pass", normal_report: "pass" } as const;
describe("phone test report", () => {
  it("accepts an all-pass report without an issue", () => {
    expect(PhoneTestReportSchema.safeParse({ phoneModel: "Samsung A15", results: pass, sendToIt: true }).success).toBe(true);
  });
  it("requires an issue description when any check fails", () => {
    const results = { ...pass, recording_upload: "fail" };
    expect(PhoneTestReportSchema.safeParse({ phoneModel: "Samsung A15", results, sendToIt: true }).success).toBe(false);
    expect(failedCount(results)).toBe(1);
  });
  it("rejects a report missing a check", () => {
    const { install: _, ...partial } = pass;
    expect(PhoneTestReportSchema.safeParse({ phoneModel: "Samsung A15", results: partial, sendToIt: false }).success).toBe(false);
  });
});
