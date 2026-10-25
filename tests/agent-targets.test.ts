import { describe, expect, it } from "vitest";
import { fillPercent, parseAgentTargets } from "@/lib/agent-targets";
import { summarizeDailyAllocation } from "@/lib/daily-allocation";

const day = "2026-10-25"; // Sunday
const receipts = (agent: string, n: number) => Array.from({ length: n }, (_, i) => ({ agent_id: agent, lead_id: `${agent}-${i}`, work_date: day }));

describe("per-agent daily targets", () => {
  it("unset agents default to 50", () => {
    expect(summarizeDailyAllocation(day, [{ id: "a", name: "A" }], []).agents[0]!.target).toBe(50);
  });
  it("targets above 50, below 1 or fractional are rejected", () => {
    expect(parseAgentTargets({ targets: { a: 51, b: 0, c: 2.5, d: 30 } })).toEqual({ d: 30 });
  });
  it("remaining and percent use the agent's own target", () => {
    const r = summarizeDailyAllocation(day, [{ id: "a", name: "A" }], receipts("a", 15), { a: 30 }).agents[0]!;
    expect([r.target, r.remaining, r.percent]).toEqual([30, 15, 50]);
  });
  it("percent caps at 100 and reaching target counts complete", () => {
    expect(fillPercent(65, 50)).toBe(100);
    expect(summarizeDailyAllocation(day, [{ id: "a", name: "A" }], receipts("a", 20), { a: 20 }).completeCount).toBe(1);
  });
});
