import { describe, expect, it } from "vitest";
import { pctChange, previousPeriod, validateRange } from "@/lib/search-console-range";
describe("search console ranges", () => {
  it("rejects reversed ranges", () => expect(validateRange({ startDate: "2026-10-10", endDate: "2026-10-01" }, "2026-10-30")).not.toBeNull());
  it("rejects future end dates", () => expect(validateRange({ startDate: "2026-10-01", endDate: "2026-11-01" }, "2026-10-30")).not.toBeNull());
  it("rejects data older than ~16 months", () => expect(validateRange({ startDate: "2025-01-01", endDate: "2025-02-01" }, "2026-10-30")).not.toBeNull());
  it("accepts a valid range", () => expect(validateRange({ startDate: "2026-10-01", endDate: "2026-10-27" }, "2026-10-30")).toBeNull());
  it("previous period has the same length and ends the day before", () =>
    expect(previousPeriod({ startDate: "2026-10-01", endDate: "2026-10-07" })).toEqual({ startDate: "2026-09-24", endDate: "2026-09-30" }));
  it("no baseline gives no percent", () => { expect(pctChange(3, 0)).toBeNull(); expect(pctChange(15, 10)).toBeCloseTo(0.5); });
});
