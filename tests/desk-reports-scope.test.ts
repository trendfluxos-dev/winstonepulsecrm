import { describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ caller: { scope: "authority", profile: null } as { scope: string; profile: { id: string } | null }, eqs: [] as [string, unknown][] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ handler: (fn: () => unknown) => fn }) }));
vi.mock("@/lib/access.server", () => ({ resolveWorkCaller: async () => m.caller }));
vi.mock("@/lib/page-all", () => ({ pageAllParallel: async (q: (a: number, b: number) => unknown) => { q(0, 999); return { data: [], error: null }; } }));
vi.mock("@/integrations/supabase/client.server", () => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "not", "order", "range"]) chain[k] = () => chain;
  chain.eq = (c: string, v: unknown) => { m.eqs.push([c, v]); return chain; };
  return { supabaseAdmin: { from: () => chain } };
});
import { getDeskReports } from "@/lib/desk-work.functions";
const run = getDeskReports as unknown as () => Promise<unknown>;
describe("agent report counts are scoped to the signed-in agent", () => {
  it("refuses an HQ/IT authority caller", async () => {
    m.caller = { scope: "authority", profile: null };
    await expect(run()).rejects.toThrow("Agent access required");
  });
  it("filters by the session agent's own id only", async () => {
    m.caller = { scope: "agent", profile: { id: "agent-b" } };
    m.eqs = [];
    await run();
    expect(m.eqs).toEqual([["agent_id", "agent-b"]]);
  });
});
