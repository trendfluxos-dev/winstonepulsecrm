import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ error: false }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const own = { assigned_to: "me", assigned_agent_id: "me" };
      const rows: Record<string, unknown[]> = {
        profiles: [],
        leads: [
          { id: "own", status: "pending", ...own },
          { id: "conflict", assigned_to: "me", assigned_agent_id: "other" },
          { id: "foreign", assigned_to: "other", assigned_agent_id: "other" },
        ],
        call_recordings: [
          { id: "a", agent_id: "me", lead_id: "own" },
          { id: "b", agent_id: "me", lead_id: "foreign" },
        ],
        call_reports: [
          { agent_id: "me", lead_id: "own", status: "pending" },
          { agent_id: "me", lead_id: "foreign", status: "pending" },
        ],
        follow_up_events: [
          { agent_id: "me", lead_id: "own", status: "missed" },
          { agent_id: "me", lead_id: "foreign", status: "due" },
        ],
      };
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        in: () => query,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: rows[table] ?? [],
            error: state.error ? { message: "private error" } : null,
          }).then(resolve),
      };
      return query;
    },
  },
}));
vi.mock("@/lib/ai-usage.server", () => ({ logAiUsage: vi.fn() }));
import { buildCommandFacts, readResponsesStream } from "@/lib/command-agent.server";
import type { Caller } from "@/lib/access.server";
const caller = {
  scope: "agent",
  profile: { id: "me", name: "Agent" },
  userId: "user",
  readOnly: false,
  approval: "approved",
} as Caller;
beforeEach(() => {
  state.error = false;
});
describe("Command Agent scoped work review", () => {
  it("excludes foreign and conflicting ownership including historic agent activity", async () => {
    const facts = await buildCommandFacts(caller, "desk");
    expect(facts.totals.leads).toBe(1);
    expect(facts.totals.dials).toBe(1);
    expect(facts.totals.unfinished_reports).toBe(1);
    expect(facts.review_counts).toEqual({ missed_follow_ups: 1, due_follow_ups: 0 });
  });
  it("rejects anonymous callers and agents with missing profiles", async () => {
    await expect(buildCommandFacts({ ...caller, scope: "none" }, "desk")).rejects.toThrow();
    await expect(buildCommandFacts({ ...caller, profile: null }, "desk")).rejects.toThrow();
  });
  it("does not turn a failed read into zero work", async () => {
    state.error = true;
    await expect(buildCommandFacts(caller, "desk")).rejects.toThrow("কাজের তথ্য পড়া যায়নি");
  });
  it("stops a refused stream instead of returning a partial successful answer", async () => {
    const body = new Response('data: {"type":"response.refusal.delta","delta":"no"}\n\n').body;
    if (!body) throw new Error("Missing fixture stream");
    await expect(readResponsesStream(body)).rejects.toThrow();
  });
});
