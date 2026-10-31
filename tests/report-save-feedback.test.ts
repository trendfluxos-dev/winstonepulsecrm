import { describe, expect, it } from "vitest";
import { classifyReportSaveError } from "@/lib/report-save-feedback";

describe("call report save feedback", () => {
  it("hides raw database errors and offers a retry", () => {
    const f = classifyReportSaveError(new Error('new row for relation "leads" violates check constraint "leads_work_state_check"'));
    expect(f).toMatchObject({ kind: "server", retryable: true });
    expect(f.message.en).not.toMatch(/constraint|relation/);
    expect(f.detail).toContain("leads_work_state_check");
  });

  it("connection failures are retryable", () => {
    expect(classifyReportSaveError(new TypeError("Failed to fetch"))).toMatchObject({ kind: "network", retryable: true });
    expect(classifyReportSaveError(new Error(""))).toMatchObject({ kind: "network", retryable: true });
  });

  it("agent-facing validation messages are shown as-is without a retry", () => {
    const f = classifyReportSaveError(new Error("Choose a future follow-up date and time"));
    expect(f).toMatchObject({ kind: "validation", retryable: false });
    expect(f.message.en).toBe("Choose a future follow-up date and time");
  });
});
