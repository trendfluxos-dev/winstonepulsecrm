import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ full: false, reads: 0, writes: [] as unknown[] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { inputValidator: () => b, handler: (f: unknown) => f }; return b; } }));
vi.mock("@/lib/admin-gate.server", () => ({ requireAdminToken: () => { if (!m.full) throw new Error("Full IT PIN required"); } }));
vi.mock("@/lib/daily-allocation.server", () => ({ readDailyAllocation: async () => { m.reads++; return {}; } }));
vi.mock("@/lib/lead-pool.server", () => ({ activeAgents: async () => [{ id: "active" }] }));
vi.mock("@/lib/business-day", () => ({ dhakaDateOf: () => "2026-10-25" }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ insert: async (r: unknown) => { m.writes.push(r); return { error: null }; } }) } }));
import { listAgentDailyTargets, saveAgentDailyTarget } from "@/lib/agent-daily-target.functions";
const read = listAgentDailyTargets as unknown as (a: { data: { adminToken: null } }) => Promise<unknown>;
const save = saveAgentDailyTarget as unknown as (a: { data: { adminToken: null; agentId: string; target: number } }) => Promise<unknown>;
beforeEach(() => { m.full = false; m.reads = 0; m.writes = []; });
describe("IT target authority", () => {
  it("refuses HQ/agent before read or write", async () => {
    await expect(read({ data: { adminToken: null } })).rejects.toThrow("Full IT");
    await expect(save({ data: { adminToken: null, agentId: "active", target: 25 } })).rejects.toThrow("Full IT");
    expect(m.reads).toBe(0); expect(m.writes).toEqual([]);
  });
  it("appends today's target for an active agent through full IT", async () => {
    m.full = true; await save({ data: { adminToken: null, agentId: "active", target: 25 } });
    expect(m.writes).toEqual([{ agent_id: "active", target: 25, effective_day: "2026-10-25", actor_label: "IT Console" }]);
  });
  it("rejects over 50 and inactive agents without writes", async () => {
    m.full = true;
    await expect(save({ data: { adminToken: null, agentId: "active", target: 51 } })).rejects.toThrow("1–50");
    await expect(save({ data: { adminToken: null, agentId: "inactive", target: 25 } })).rejects.toThrow("Active agent");
    expect(m.writes).toEqual([]);
  });
});