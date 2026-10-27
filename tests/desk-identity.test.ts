import { describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ caller: { scope: "agent", profile: { id: "monisha" } } as { scope: string; profile: { id: string } | null }, eqs: [] as [string, unknown][] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ handler: (fn: () => unknown) => fn }) }));
vi.mock("@/lib/access.server", () => ({ resolveWorkCaller: async () => m.caller }));
vi.mock("@/lib/page-all", () => ({ pageAllParallel: async (q: (a: number, b: number) => unknown) => { q(0, 999); return { data: [], error: null }; } }));
const chain = (): Record<string, unknown> => {
  const c: Record<string, unknown> = {};
  for (const k of ["select", "not", "gte", "lte", "in", "order", "range"]) c[k] = () => c;
  c.eq = (col: string, v: unknown) => { m.eqs.push([col, v]); return c; };
  c.limit = async () => ({ data: [], error: null });
  return c;
};
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => chain() } }));
vi.mock("@/lib/follow-up-work.server", () => ({ followUpWork: () => chain() }));
import { getDeskWork } from "@/lib/desk-work.functions";
import { leadKpis } from "@/lib/kpi-contract";
const run = getDeskWork as unknown as () => Promise<{ agentId: string }>;

describe("My Desk identity is confirmed by the server session", () => {
  it("returns the session agent id and filters every read by it", async () => {
    m.caller = { scope: "agent", profile: { id: "monisha" } };
    m.eqs = [];
    const out = await run();
    expect(out.agentId).toBe("monisha");
    expect(m.eqs).toEqual([["agent_id", "monisha"], ["agent_id", "monisha"]]);
  });
  it("refuses HQ/IT PIN callers on the agent desk", async () => {
    m.caller = { scope: "authority", profile: null };
    await expect(run()).rejects.toThrow("Agent access required");
  });
  it("another agent's server id sees none of Monisha's lead metrics", async () => {
    m.caller = { scope: "agent", profile: { id: "other" } };
    const { agentId } = await run();
    const leads = [
      { id: "a", assigned_agent_id: "monisha", assigned_to: null, status: "pending", work_state: "pending", temperature: "hot" },
      { id: "b", assigned_agent_id: "monisha", assigned_to: null, status: "closed", work_state: "completed", temperature: null },
    ];
    expect(leadKpis(leads as never, agentId)).toMatchObject({ owned: 0, active: 0, hot: 0, closed: 0 });
    expect(leadKpis(leads as never, "monisha")).toMatchObject({ owned: 2, closed: 1 });
  });
});
