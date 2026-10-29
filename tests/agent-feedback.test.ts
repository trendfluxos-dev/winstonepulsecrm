import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentFeedbackSchema, feedbackWindow } from "../src/lib/agent-feedback";
const state = vi.hoisted(() => ({ data: null as { id: string } | null, error: null as { message: string } | null, agent: "" }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ select: () => ({ eq: (_key: string, agent: string) => { state.agent = agent; return { eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: state.data, error: state.error }) }) }) }; } }) }) } }));
import { feedbackRequired } from "../src/lib/agent-feedback.server";
describe("one-day agent feedback", () => {
  beforeEach(() => { state.data = null; state.error = null; state.agent = ""; });
  it("is active on October 29 at 08:48 Dhaka", () => expect(feedbackWindow(Date.parse("2026-10-29T08:48:00+06:00"))).toBe(true));
  it("stops exactly at 09:30 Dhaka", () => expect(feedbackWindow(Date.parse("2026-10-29T09:30:00+06:00"))).toBe(false));
  it("does not return on the next day", () => expect(feedbackWindow(Date.parse("2026-10-30T09:00:00+06:00"))).toBe(false));
  it("requires detailed problems, impact and requests", () => expect(agentFeedbackSchema.safeParse({ problem: "", impact: "", improvement: "" }).success).toBe(false));
  it("allows an honest no-problem response", () => expect(agentFeedbackSchema.safeParse({ problem: "I have no current system problem.", impact: "My work is continuing normally.", improvement: "No changes needed at present." }).success).toBe(true));
  it("checks only the requesting agent's saved feedback", async () => {
    expect(await feedbackRequired("agent-a", Date.parse("2026-10-29T03:00:00Z"))).toBe(true);
    expect(state.agent).toBe("agent-a");
    state.data = { id: "saved-a" };
    expect(await feedbackRequired("agent-a", Date.parse("2026-10-29T03:00:00Z"))).toBe(false);
    state.data = null;
    expect(await feedbackRequired("agent-b", Date.parse("2026-10-29T03:00:00Z"))).toBe(true);
    expect(state.agent).toBe("agent-b");
  });
  it("fails closed on a response read error", async () => { state.error = { message: "offline" }; await expect(feedbackRequired("agent-a", Date.parse("2026-10-29T03:00:00Z"))).rejects.toThrow(); });
});