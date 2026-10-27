import { describe, expect, it } from "vitest";
import { performanceDate, shiftPerformanceDate } from "@/lib/performance-history";

describe("performance history dates", () => {
  it("accepts the requested previous day", () => {
    expect(performanceDate("2026-10-26", "2026-10-27")).toBe("2026-10-26");
  });
  it("rejects future dates", () => {
    expect(() => performanceDate("2026-10-28", "2026-10-27")).toThrow();
  });
  it("rejects impossible calendar dates", () => {
    expect(() => performanceDate("2026-02-30", "2026-10-27")).toThrow();
  });
  it("rejects non-date inputs", () => {
    expect(() => performanceDate("2026-10-26T12:00:00Z", "2026-10-27")).toThrow();
  });
  it("moves to the prior calendar day across a month boundary", () => {
    expect(shiftPerformanceDate("2026-10-01", -1)).toBe("2026-09-30");
  });
});