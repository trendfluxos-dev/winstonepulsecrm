import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ error: false, calls: [] as unknown[][], rows: [] as { agent_id: string; lead_id: string; work_date: string }[] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  m.calls.push(["from", table]);
  let start = 0, end = 999;
  const b: Record<string, (...args: any[]) => any> = {};
  for (const key of ["select", "eq", "in", "order"]) b[key] = (...args) => { m.calls.push([key, ...args]); return b; };
  b.range = (s: number, e: number) => { start = s; end = e; return b; };
  b.then = (resolve: (value: unknown) => void) => resolve({ data: m.rows.slice(start, end + 1), error: m.error ? { message: "private raw error" } : null });
  return b;
} } }));
import { readAllocationReceipts } from "@/lib/allocation-ledger.server";
import { assignedTodayByAgent } from "@/lib/lead-pool.server";
const day = "2026-10-25";
beforeEach(() => { m.error = false; m.calls = []; m.rows = []; });
describe("shared assignment receipt reader", () => {
  it("uses day and self roster filters, without querying mutable lead work", async () => {
    await readAllocationReceipts(day, ["own"]);
    expect(m.calls).toContainEqual(["from", "lead_daily_assignment_ledger"]);
    expect(m.calls).toContainEqual(["eq", "work_date", day]);
    expect(m.calls).toContainEqual(["in", "agent_id", ["own"]]);
    expect(m.calls.some(c => c[0] === "from" && c[1] === "leads")).toBe(false);
  });
  it("does not read the ledger for an empty active roster", async () => {
    expect(await readAllocationReceipts(day, [])).toEqual([]); expect(m.calls).toEqual([]);
  });
  it("reads every page rather than truncating assignments at 1000", async () => {
    m.rows = Array.from({ length: 1001 }, (_, i) => ({ agent_id: "a", lead_id: String(i), work_date: day }));
    expect((await readAllocationReceipts(day)).length).toBe(1001);
  });
  it("fails closed on a read failure instead of inventing zero allocations", async () => {
    m.error = true; await expect(assignedTodayByAgent(day)).rejects.toThrow("Daily allocation unavailable");
  });
  it("distribution capacity counts unique historical receipts, not rolled over work", async () => {
    m.rows = [{ agent_id: "a", lead_id: "1", work_date: day }, { agent_id: "a", lead_id: "1", work_date: day }, { agent_id: "b", lead_id: "2", work_date: day }];
    expect([...await assignedTodayByAgent(day)]).toEqual([["a", 1], ["b", 1]]);
  });
});