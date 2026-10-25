import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ allowed: true, changed: false, writes: [] as string[], audits: [] as Record<string, unknown>[] }));
const agent = "11111111-1111-4111-8111-111111111111";
const lead = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { inputValidator: () => b, handler: (fn: unknown) => fn }; return b; } }));
vi.mock("@/lib/access.server", () => ({ requireLeadHub: async () => { if (!m.allowed) throw new Error("LeadHub PIN required"); } }));
vi.mock("@/lib/business-day", () => ({ assertDistributionDay: () => {} }));
vi.mock("@/lib/lead-pool.server", () => ({ dhakaToday: () => "2026-10-24", activeAgents: async () => [{ id: agent, name: "Agent" }], assignedTodayByAgent: async () => new Map(), dailyPlan: async () => ({ perAgent: 50 }), usablePoolCount: async () => 1, assignedPhoneKeys: async () => new Set() }));
vi.mock("@/lib/lead-eligibility.server", () => ({ eligibleLeadIds: async (ids: string[]) => ids }));
vi.mock("@/lib/audit.server", () => ({ logAudit: async (value: Record<string, unknown>) => { m.audits.push(value); } }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  let op = "read";
  const b: Record<string, (...args: any[]) => any> = {};
  for (const key of ["select", "eq", "is", "or", "order", "range", "contains", "in"]) b[key] = () => b;
  b.update = () => { op = "update"; m.writes.push(table); return b; };
  b.insert = () => { op = "insert"; m.writes.push(table); return b; };
  b.then = (resolve: (value: unknown) => void) => resolve({ error: null, data: table === "audit_logs" ? [] : op === "update" ? [{ id: lead }] : op === "insert" ? [] : [{ id: m.changed ? other : lead, name: "Reviewed lead", phone_number: "01805049666", created_at: "2026-10-01" }] });
  return b;
} } }));
import { previewLeadCounts, assignLeadCounts } from "@/lib/coordinator-deck.functions";
const data = { requestId: "44444444-4444-4444-8444-444444444444", rows: [{ agentId: agent, count: 1 }], reviewedLeadIds: [lead] };
const invoke = (fn: unknown) => (fn as (arg: { data: typeof data }) => Promise<any>)({ data });
beforeEach(() => { m.allowed = true; m.changed = false; m.writes = []; m.audits = []; });
describe("assignment preview and audit boundary", () => {
  it("preview reads actual candidates and performs no writes or audit mutation", async () => {
    const result = await invoke(previewLeadCounts);
    expect(result.proposals[0].leads.map((l: { id: string }) => l.id)).toEqual([lead]);
    expect(m.writes).toEqual([]); expect(m.audits).toEqual([]);
  });
  it("refuses changed candidates before any update", async () => {
    m.changed = true;
    await expect(invoke(assignLeadCounts)).rejects.toThrow("changed");
    expect(m.writes).toEqual([]);
  });
  it("confirmation retains lead assignment history and reviewed IDs in audit", async () => {
    const result = await invoke(assignLeadCounts);
    expect(result.results[0].assigned).toBe(1);
    expect(m.writes).toEqual(["leads", "lead_assignments"]);
    expect(m.audits[0]).toMatchObject({ action: "lead_assigned", metadata: { reviewedLeadIds: [lead], leadIds: [lead], requestId: data.requestId } });
  });
  it("preview itself requires LeadHub authority", async () => {
    m.allowed = false;
    await expect(invoke(previewLeadCounts)).rejects.toThrow("LeadHub PIN required");
    expect(m.writes).toEqual([]);
  });
});