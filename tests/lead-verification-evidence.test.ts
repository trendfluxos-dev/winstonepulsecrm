import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyLeadFromCallEvidence, type CallEvidenceRow } from "@/lib/lead-verification";

const AGENT = "agent-a";
const LEAD = "11111111-1111-4111-8111-111111111111";
const UID = "and-abc123-1800000000000";
const good: CallEvidenceRow = {
  agent_id: AGENT, lead_id: LEAD, call_status: "completed", duration_seconds: 48,
  call_source: "android_sim", external_call_id: UID, talk_time_source: "call_log",
};
const check = (row: CallEvidenceRow | null, callUid: string | null = UID) =>
  verifyLeadFromCallEvidence({ callUid, row, agentId: AGENT, leadId: LEAD });

describe("lead verification needs valid call evidence", () => {
  it("verifies only a completed, phone-measured call with talk time for this agent and lead", () => {
    expect(check(good)).toEqual({ verified: true, reason: "verified" });
    expect(check({ ...good, call_source: "android_dialer", external_call_id: "log-55-1711223344" }, "log-55-1711223344").verified).toBe(true);
  });
  it("missing call id or missing call record never verifies", () => {
    expect(check(good, null)).toEqual({ verified: false, reason: "no_call_id" });
    expect(check(null)).toEqual({ verified: false, reason: "no_call_record" });
    expect(check({ ...good, external_call_id: "and-other-1" })).toEqual({ verified: false, reason: "no_call_record" });
  });
  it("another agent's or another lead's call never verifies", () => {
    expect(check({ ...good, agent_id: "agent-b" }).reason).toBe("other_agent");
    expect(check({ ...good, lead_id: "22222222-2222-4222-8222-222222222222" }).reason).toBe("other_lead");
  });
  it("incomplete call proof never verifies", () => {
    for (const status of ["initiated", "answered", "no_answer", "failed", null]) {
      expect(check({ ...good, call_status: status }).reason).toBe("call_not_completed");
    }
    for (const seconds of [0, -3, null, Number.NaN]) {
      expect(check({ ...good, duration_seconds: seconds }).reason).toBe("no_talk_time");
    }
  });
  it("app 2.21 app-dialled call: ringing-inclusive time without call-history proof never verifies", () => {
    // 2.21 sent "completed" with dial-to-hang-up seconds even when nobody answered.
    expect(check({ ...good, talk_time_source: null, duration_seconds: 75 }).reason).toBe("not_phone_measured");
    expect(check({ ...good, talk_time_source: undefined }).reason).toBe("not_phone_measured");
    expect(check({ ...good, talk_time_source: "live" }).reason).toBe("not_phone_measured");
  });
  it("phone-dialer call verifies with call-history proof", () => {
    expect(check({ ...good, call_source: "android_dialer", talk_time_source: "call_log" }).verified).toBe(true);
  });
  it("time not measured by the phone (live dialer, web timer, manual) never verifies", () => {
    expect(check({ ...good, call_source: "android_dialer", external_call_id: UID, talk_time_source: null }).reason).toBe("not_phone_measured");
    expect(check({ ...good, call_source: "web", external_call_id: UID }).reason).toBe("not_phone_measured");
    expect(check({ ...good, call_source: null }).reason).toBe("not_phone_measured");
  });
});

// ---- endpoint: the phone's connected flag alone cannot mark a lead verified ----
const s = vi.hoisted(() => ({
  call: null as null | Record<string, unknown>,
  callError: null as null | { message: string },
  rpc: [] as Array<Record<string, unknown>>,
  leadPatches: [] as Array<Record<string, unknown>>,
}));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (v: unknown) => v }));
vi.mock("@/lib/device-auth.server", () => ({
  resolveApiCaller: async () => ({ kind: "device", profile: { id: "agent-a" }, device: { id: "dev-1" } }),
}));
vi.mock("@/lib/agent-briefing.server", () => ({ requireAgentBriefing: async () => null }));
vi.mock("@/lib/lead-events.server", () => ({ logLeadEvent: async () => undefined }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async (_fn: string, args: Record<string, unknown>) => { s.rpc.push(args); return { data: { ok: true, duplicate: false }, error: null }; },
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain, eq: () => chain,
        update: (patch: Record<string, unknown>) => { if (table === "leads") s.leadPatches.push(patch); return chain; },
        maybeSingle: async () => table === "call_recordings"
          ? { data: s.call, error: s.callError }
          : { data: { id: "11111111-1111-4111-8111-111111111111", notes: null, call_attempts: 0, assigned_to: "agent-a", assigned_agent_id: "agent-a" }, error: null },
        then: (fn: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(fn),
      };
      return chain;
    },
  },
}));

import { Route } from "@/routes/api/public/ingest/outcome";
type R = { server: { handlers: { POST: (v: { request: Request }) => Promise<Response> } } };
const post = (body: unknown) => (Route as unknown as R).server.handlers.POST({
  request: new Request("https://example.test/x", { method: "POST", body: JSON.stringify(body) }),
});

beforeEach(() => { s.call = null; s.callError = null; s.rpc = []; s.leadPatches = []; });

describe("phone outcome endpoint", () => {
  it("connected=true with no call record does not verify the lead", async () => {
    const res = await post({ lead_id: LEAD, outcome: "interested", connected: true, call_uid: UID });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(s.rpc[0]._connected).toBe(false);
    expect(body).toMatchObject({ verified: false, verification_reason: "no_call_record", connected_claimed: true });
  });
  it("app 2.21 'completed' row with ringing time and no call-history proof does not verify", async () => {
    s.call = { ...good, talk_time_source: null, duration_seconds: 75 };
    const body = await (await post({ lead_id: LEAD, outcome: "interested", connected: true, call_uid: UID })).json();
    expect(s.rpc[0]._connected).toBe(false);
    expect(body.verification_reason).toBe("not_phone_measured");
  });
  it("connected=true with an unanswered call (0 s) does not verify", async () => {
    s.call = { ...good, call_status: "no_answer", duration_seconds: 0 };
    await post({ lead_id: LEAD, outcome: "interested", connected: true, call_uid: UID });
    expect(s.rpc[0]._connected).toBe(false);
  });
  it("valid call evidence verifies even if the phone did not claim connected", async () => {
    s.call = { ...good };
    const body = await (await post({ lead_id: LEAD, outcome: "interested", call_uid: UID })).json();
    expect(s.rpc[0]._connected).toBe(true);
    expect(body.verified).toBe(true);
  });
  it("legacy payload without call id never writes is_verified", async () => {
    const body = await (await post({ lead_id: LEAD, outcome: "interested", connected: true })).json();
    expect(s.leadPatches).toHaveLength(1);
    expect("is_verified" in s.leadPatches[0]).toBe(false);
    expect(body).toMatchObject({ verified: false, verification_reason: "no_call_id", legacy: true });
  });
  it("unreadable call evidence fails closed with a retryable error and saves nothing", async () => {
    s.callError = { message: "db down" };
    const res = await post({ lead_id: LEAD, outcome: "interested", connected: true, call_uid: UID });
    expect(res.status).toBe(500);
    expect(s.rpc).toHaveLength(0);
  });
});
