import { beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({
  owner: "agent-a" as string | null, legacy: "agent-a" as string | null,
  caller: "agent" as string, lookupError: false, briefingBlocked: false,
  writes: [] as Array<{ table: string; patch: Record<string, unknown> }>,
  reports: 0, events: 0, existing: "lead-a" as string | null,
  intakes: [] as Array<Record<string, unknown>>,
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/lib/access.server", () => ({ resolveWorkCaller: async () => ({ scope: s.caller, profile: { id: "agent-a", name: "Agent A" } }) }));
vi.mock("@/lib/agent-briefing.server", () => ({ assertAgentBriefing: async () => { if (s.briefingBlocked) throw new Error("briefing required"); } }));
vi.mock("@/lib/call-reports.server", () => ({ openCallReport: async () => { s.reports++; return { id: "report-a" }; } }));
vi.mock("@/lib/lead-events.server", () => ({ logLeadEvent: async () => { s.events++; } }));
vi.mock("@/lib/lead-eligibility.server", () => ({ resolveLeadIdByPhone: async () => ({ canonicalPhones: ["01700000000"], existingLeadId: s.existing }) }));
vi.mock("@/lib/lead-intake.server", () => ({ normalizeLeadPhone: (v: string) => v, intakeLead: async (input: Record<string, unknown>) => {
  s.intakes.push(input); s.owner = null; s.legacy = null; return { leadId: "new-lead", duplicate: false };
} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  const chain = {
    select: () => chain, eq: () => chain,
    insert: (patch: Record<string, unknown>) => { s.writes.push({ table, patch }); return chain; },
    update: (patch: Record<string, unknown>) => { s.writes.push({ table, patch }); return chain; },
    maybeSingle: async () => table === "leads"
      ? { data: s.lookupError ? null : { id: "lead-a", assigned_to: s.owner, assigned_agent_id: s.legacy, phone_number: "01700000000" }, error: s.lookupError ? { message: "failed" } : null }
      : { data: { id: "recording-a" }, error: null },
    single: async () => ({ data: { id: "recording-a" }, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
  }; return chain;
} } }));

import { logIncomingCallback, logAnyNumberCall } from "@/lib/call-reports.functions";
const invoke = (fn: unknown, data: unknown) => (fn as (args: { data: unknown }) => Promise<unknown>)({ data });
beforeEach(() => { s.owner = "agent-a"; s.legacy = "agent-a"; s.caller = "agent"; s.lookupError = false; s.briefingBlocked = false; s.writes = []; s.reports = 0; s.events = 0; s.existing = "lead-a"; s.intakes = []; });

describe("callback and manual calls never bypass LeadHub ownership", () => {
  for (const [name, fn, data] of [
    ["callback", logIncomingCallback, { leadId: "lead-a", durationSeconds: 10 }],
    ["manual incoming", logAnyNumberCall, { phoneNumber: "01700000000", direction: "incoming", durationSeconds: 10 }],
    ["manual outgoing", logAnyNumberCall, { phoneNumber: "01700000000", direction: "outgoing", durationSeconds: 10 }],
  ] as const) {
    for (const [label, owner, legacy] of [["unassigned", null, null], ["foreign", "agent-b", "agent-b"], ["legacy foreign", null, "agent-b"]] as const) {
      it(`${name} rejects ${label} before any writes`, async () => {
        s.owner = owner; s.legacy = legacy;
        await expect(invoke(fn, data)).rejects.toThrow("এই লিড আপনার তালিকায় নেই");
        expect(s.writes).toEqual([]); expect(s.reports).toBe(0); expect(s.events).toBe(0);
      });
    }
    it(`${name} preserves own-lead reports without assignment writes`, async () => {
      s.owner = null;
      await expect(invoke(fn, data)).resolves.toMatchObject({ id: "report-a" });
      expect(s.reports).toBe(1); expect(s.events).toBe(1);
      expect(s.writes.filter((w) => "assigned_to" in w.patch || "assigned_agent_id" in w.patch)).toEqual([]);
      expect(s.writes.some((w) => w.table === "call_recordings")).toBe(true);
    });
    it(`${name} fails closed on missing ownership lookup`, async () => {
      s.lookupError = true;
      await expect(invoke(fn, data)).rejects.toThrow(); expect(s.writes).toEqual([]);
    });
    it(`${name} preserves the briefing gate`, async () => {
      s.briefingBlocked = true;
      await expect(invoke(fn, data)).rejects.toThrow("briefing required"); expect(s.writes).toEqual([]);
    });
  }
  it("anonymous callback creates no records", async () => {
    s.caller = "none";
    await expect(invoke(logIncomingCallback, { leadId: "lead-a" })).rejects.toThrow(); expect(s.writes).toEqual([]);
  });
  it("a new manual number enters canonical intake unassigned, without recording or reporting", async () => {
    s.existing = null;
    await expect(invoke(logAnyNumberCall, { phoneNumber: "01700000000", direction: "incoming" })).rejects.toThrow("LeadHub");
    expect(s.intakes).toHaveLength(1); expect(s.intakes[0]?.ownerId).toBeNull();
    expect(s.writes).toEqual([]); expect(s.reports).toBe(0);
  });
});