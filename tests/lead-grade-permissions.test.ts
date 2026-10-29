import { beforeEach, expect, it, vi } from "vitest";
import type { Caller } from "@/lib/access.server";

const state = vi.hoisted(() => ({
  caller: { scope: "agent", readOnly: false, profile: { id: "agent-a", name: "Agent" } } as Caller,
  writes: [] as Array<{ table: string; patch: Record<string, unknown> }>,
  reads: 0,
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn };
  return chain;
} }));
vi.mock("@/lib/access.server", () => ({
  resolveCaller: async () => state.caller,
  requireWrite: (c: Caller) => { if (c.readOnly) throw new Error("HQ view-only"); },
  requireAuthority: (c: Caller) => { if (c.scope !== "authority") throw new Error("Authority required"); },
  requireDispatch: vi.fn(),
}));
vi.mock("@/lib/audit.server", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/lead-events.server", () => ({ logLeadEvent: vi.fn() }));
vi.mock("@/lib/assigned-lead-scope.server", () => ({ assertAssignedLead: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  state.reads++;
  const chain = {
    select: () => chain, eq: () => chain,
    update: (patch: Record<string, unknown>) => { state.writes.push({ table, patch }); return chain; },
    insert: (patch: Record<string, unknown>) => { state.writes.push({ table, patch }); return chain; },
    maybeSingle: async () => ({ data: table === "call_reports"
      ? { id: "report-a", lead_id: "lead-a", agent_id: "agent-a", status: "submitted", connected: true, temperature: "warm", grade: "B", call_ended_at: "2026-10-29T04:00:00Z" }
      : { id: "lead-a", name: "Lead", assigned_to: "agent-a", assigned_agent_id: "agent-a" }, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  return chain;
} } }));

import { allowedActions } from "@/lib/command-agent.server";
import { runCommandAgentAction } from "@/lib/command-agent.functions";
import { editSubmittedReport } from "@/lib/call-reports.server";
const invoke = () => (runCommandAgentAction as unknown as (arg: unknown) => Promise<unknown>)({ data: {
  surface: "desk", action: { type: "classify_lead", params: { lead_id: "lead-a", temperature: "hot", grade: "A" } },
} });

beforeEach(() => {
  vi.useRealTimers();
  state.caller = { scope: "agent", readOnly: false, profile: { id: "agent-a", name: "Agent" } } as Caller;
  state.writes = []; state.reads = 0;
});

for (const scope of ["agent", "coordinator", "none"] as const) it(`${scope} cannot directly set grades, even on owned leads`, async () => {
  state.caller.scope = scope;
  expect(allowedActions(state.caller)).not.toContain("classify_lead");
  await expect(invoke()).rejects.toThrow();
  expect(state.reads).toBe(0);
  expect(state.writes).toEqual([]);
});

it("HQ read-only authority cannot change grades", async () => {
  state.caller.scope = "authority"; state.caller.readOnly = true;
  expect(allowedActions(state.caller)).not.toContain("classify_lead");
  await expect(invoke()).rejects.toThrow("view-only");
  expect(state.writes).toEqual([]);
});

it("verified writable IT/admin authority can correct grades with classification history", async () => {
  state.caller.scope = "authority"; state.caller.profile = null;
  await expect(invoke()).resolves.toMatchObject({ ok: true });
  expect(state.writes.find(w => w.table === "leads")?.patch).toMatchObject({ grade: "A", temperature: "hot" });
  expect(state.writes.find(w => w.table === "lead_classifications")?.patch).toMatchObject({ grade: "A", source: "authority" });
});

it("an agent report edit preserves saved B grade instead of the supplied A", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T04:30:00Z"));
  try {
    await editSubmittedReport({ reportId: "report-a", agentId: "agent-a", category: "interested", summary: "Requested prices", grade: "A", temperature: "hot" });
    expect(state.writes.find(w => w.table === "call_reports")?.patch).toMatchObject({ grade: "B", temperature: "warm" });
    expect(state.writes.find(w => w.table === "leads")?.patch).toMatchObject({ grade: "B", temperature: "warm" });
  } finally { vi.useRealTimers(); }
});