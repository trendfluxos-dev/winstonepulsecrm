import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ scope: "none", profile: null as null | { id: string }, leadHub: false, reads: [] as (string | undefined)[] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const builder = { inputValidator: () => builder, handler: (fn: unknown) => fn }; return builder; } }));
vi.mock("@/lib/access.server", () => ({
  resolveCaller: async () => ({ scope: m.scope, profile: m.profile }),
  resolveWorkCaller: async (token: unknown) => { expect(token).toBeNull(); return { scope: m.scope, profile: m.profile }; },
  requireAuthority: (caller: { scope: string }) => { if (caller.scope !== "authority") throw new Error("Master PIN required"); },
  requireLeadHub: async () => { if (!m.leadHub) throw new Error("LeadHub PIN required"); },
}));
vi.mock("@/lib/daily-allocation.server", () => ({ readDailyAllocation: async (agentId?: string) => { m.reads.push(agentId); return { total: 0 }; } }));
import { getDailyAllocation } from "@/lib/daily-allocation.functions";
const invoke = (surface: "hq" | "leadhub" | "self") => (getDailyAllocation as unknown as (arg: { data: { surface: string; adminToken: string } }) => Promise<unknown>)({ data: { surface, adminToken: "untrusted-input" } });
beforeEach(() => { m.scope = "none"; m.profile = null; m.leadHub = false; m.reads = []; });
describe("daily allocation read boundaries", () => {
  it("denies unauthorised HQ before any ledger read", async () => {
    await expect(invoke("hq")).rejects.toThrow("Master PIN"); expect(m.reads).toEqual([]);
  });
  it("allows existing read-only authority team summary", async () => {
    m.scope = "authority"; await invoke("hq"); expect(m.reads).toEqual([undefined]);
  });
  it("does not treat HQ authority as a LeadHub PIN", async () => {
    m.scope = "authority"; await expect(invoke("leadhub")).rejects.toThrow("LeadHub PIN"); expect(m.reads).toEqual([]);
  });
  it("allows verified LeadHub team summary", async () => {
    m.leadHub = true; await invoke("leadhub"); expect(m.reads).toEqual([undefined]);
  });
  it("self view reads only the signed-in agent, never a supplied PIN", async () => {
    m.scope = "agent"; m.profile = { id: "own-agent" }; await invoke("self"); expect(m.reads).toEqual(["own-agent"]);
  });
  it("does not allow PIN authority to impersonate an agent", async () => {
    m.scope = "authority"; await expect(invoke("self")).rejects.toThrow("Agent access"); expect(m.reads).toEqual([]);
  });
});