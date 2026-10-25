import { describe, expect, it } from "vitest";
import { allocationProgress, validDailyTarget } from "@/lib/agent-daily-target";
import { summarizeDailyAllocation } from "@/lib/daily-allocation";
describe("individual allocation targets within 50", () => {
  it("accepts only integers from 1 to 50", () => {
    expect([1, 25, 50].every(validDailyTarget)).toBe(true);
    expect([0, -1, 51, 25.5, NaN].some(validDailyTarget)).toBe(false);
  });
  it("uses individual targets for remaining and progress, hard quota unchanged", () => {
    const day = "2026-10-25";
    const result = summarizeDailyAllocation(day, [{ id: "a", name: "A" }, { id: "b", name: "B" }], Array.from({ length: 10 }, (_, i) => ({ agent_id: "a", lead_id: String(i), work_date: day })), new Map([["a", 25]]));
    expect(result.quota).toBe(50);
    expect(result.agents[0]).toMatchObject({ target: 25, received: 10, remaining: 15, progress: 40 });
    expect(result.agents[1]).toMatchObject({ target: 50, remaining: 50, progress: 0 });
  });
  it("caps percentage at 100 without hiding historical receipts", () => {
    expect(allocationProgress(65, 50)).toBe(100);
    expect(allocationProgress(0, 50)).toBe(0);
  });
  it("does not demand remaining work on Friday for custom targets", () => {
    expect(summarizeDailyAllocation("2026-10-23", [{ id: "a", name: "A" }], [], new Map([["a", 25]])).agents[0]).toMatchObject({ remaining: 0, zeroAlert: false });
  });
});