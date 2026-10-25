import { describe, expect, it } from "vitest";
import { summarizeDailyAllocation } from "@/lib/daily-allocation";
const agents = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const day = "2026-10-25";
const receipt = (agent_id: string, lead_id: string, work_date = day) => ({ agent_id, lead_id, work_date });
describe("daily new allocation", () => {
  it("warns when active agents receive zero new leads", () => {
    expect(summarizeDailyAllocation(day, agents, [])).toMatchObject({ total: 0, zeroCount: 2, showZeroAlert: true, remaining: 100 });
  });
  it("warns for the zero agent even when another received leads", () => {
    expect(summarizeDailyAllocation(day, agents, [receipt("a", "1")])).toMatchObject({ total: 1, zeroCount: 1, showZeroAlert: true });
  });
  it("counts only unique lead receipts for active agents on the Dhaka day", () => {
    expect(summarizeDailyAllocation(day, agents, [receipt("a", "1"), receipt("a", "1"), receipt("a", "old", "2026-10-24"), receipt("inactive", "2")]).total).toBe(1);
  });
  it("uses 50 per active agent without truncating historical totals", () => {
    const result = summarizeDailyAllocation(day, agents, Array.from({ length: 65 }, (_, i) => receipt("a", String(i))));
    expect(result).toMatchObject({ quota: 50, total: 65, completeCount: 1, remaining: 50 });
    expect(result.agents[0]?.remaining).toBe(0);
  });
  it("does not warn or demand assignments on Friday", () => {
    expect(summarizeDailyAllocation("2026-10-23", agents, [])).toMatchObject({ distributionOpen: false, showZeroAlert: false, remaining: 0 });
  });
  it("does not produce a zero-distribution alarm without active agents", () => {
    expect(summarizeDailyAllocation(day, [], [])).toMatchObject({ total: 0, showZeroAlert: false });
  });
});