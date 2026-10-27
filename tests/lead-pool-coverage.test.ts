import { describe, expect, it } from "vitest";
import { leadPoolCoverage } from "@/lib/lead-pool-coverage";
describe("14-day lead pool coverage", () => {
  const agents = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  it("uses each agent target and fallback across 12 non-Friday days", () => {
    expect(leadPoolCoverage(agents, new Map([["a", 30]]), 20, "2026-10-28", 599)).toMatchObject({ dailyNeed: 50, allocationDays: 12, need: 600, shortage: true, shortfall: 1, to: "2026-11-10" });
  });
  it("does not warn at the exact threshold", () => {
    expect(leadPoolCoverage(agents, new Map([["a", 30]]), 20, "2026-10-28", 600).shortage).toBe(false);
  });
  it("caps every daily target at 50 and excludes configured holidays", () => {
    expect(leadPoolCoverage(agents, new Map([["a", 99]]), 20, "2026-10-28", 0, ["2026-10-29"]).rows).toEqual([{ id: "a", name: "A", dailyTarget: 50, need: 550 }, { id: "b", name: "B", dailyTarget: 20, need: 220 }]);
  });
});