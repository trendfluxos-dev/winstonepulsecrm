import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// Isolated: every database call is mocked — nothing is written anywhere.
const s = vi.hoisted(() => ({
  intake: null as null | Record<string, unknown>,
  rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcResult: { data: null as unknown, error: null as null | { message: string } },
  leadUpdates: 0,
  events: 0,
  lead: { id: "l", notes: null, call_attempts: 0, assigned_to: "agent-a", assigned_agent_id: "agent-a" } as Record<string, unknown>,
  revokeFilters: [] as Array<[string, unknown]>,
  revoked: 1,
}));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (v: unknown) => v }));
vi.mock("@/lib/device-auth.server", () => ({
  resolveApiCaller: async () => ({ kind: "device", profile: { id: "agent-a" }, device: { id: "dev-1", app_version: "2.18" } }),
  hashToken: async (t: string) => `hash:${t}`,
}));
vi.mock("@/lib/agent-briefing.server", () => ({ requireAgentBriefing: async () => null }));
vi.mock("@/lib/version-ledger.server", () => ({ recordVersionData: async () => undefined }));
vi.mock("@/lib/lead-events.server", () => ({ logLeadEvent: async () => { s.events++; } }));
vi.mock("@/lib/lead-intake.server", () => ({
  intakeLead: async (v: Record<string, unknown>) => { s.intake = v; return { leadId: "11111111-1111-4111-8111-111111111111", duplicate: false, assignedTo: null }; },
  InvalidLeadPhoneError: class extends Error {},
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async (fn: string, args: Record<string, unknown>) => { s.rpc.push({ fn, args }); return s.rpcResult; },
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (k: string, v: unknown) => { if (table === "agent_devices") s.revokeFilters.push([k, v]); return chain; },
        is: (k: string, v: unknown) => { s.revokeFilters.push([k, v]); return { select: async () => ({ data: Array.from({ length: s.revoked }, () => ({ id: "dev-1" })), error: null }) }; },
        update: () => { if (table === "leads") s.leadUpdates++; return chain; },
        maybeSingle: async () => ({ data: table === "profiles" ? { id: "agent-a", name: "Agent A" } : s.lead, error: null }),
        then: (fn: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(fn),
      };
      return chain;
    },
  },
}));

import { Route as LeadRoute } from "@/routes/api/public/ingest/lead";
import { Route as OutcomeRoute } from "@/routes/api/public/ingest/outcome";
import { Route as LogoutRoute } from "@/routes/api/public/agent/logout";

type Handler = { server: { handlers: { POST: (v: { request: Request }) => Promise<Response> } } };
const LEAD = "11111111-1111-4111-8111-111111111111";
const post = (route: unknown, body: unknown, headers: Record<string, string> = {}) =>
  (route as Handler).server.handlers.POST({
    request: new Request("https://example.test/x", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }),
  });
const src = (p: string) => readFileSync(p, "utf8");

beforeEach(() => {
  s.intake = null; s.rpc = []; s.rpcResult = { data: { ok: true, duplicate: false }, error: null };
  s.leadUpdates = 0; s.events = 0; s.revokeFilters = []; s.revoked = 1;
  s.lead = { id: LEAD, notes: null, call_attempts: 0, assigned_to: "agent-a", assigned_agent_id: "agent-a" };
});

describe("P1-3 phone-captured leads enter LeadHub unassigned", () => {
  it("ignores assign=true and a payload agent_id; keeps capture attribution", async () => {
    const res = await post(LeadRoute, { name: "Synthetic", phone_number: "01700000000", assign: true, agent_id: "22222222-2222-4222-8222-222222222222" });
    expect(res.status).toBe(201);
    expect(s.intake?.ownerId).toBeNull();
    expect(s.intake?.actorProfileId).toBe("agent-a");
    expect(s.intake?.referenceBy).toBe("Agent A");
    expect((await res.json()).assigned_to).toBeNull();
  });
  it("Android no longer asks for self-assignment", () => {
    const k = src("android/app/src/main/java/com/winstone/connect/data/remote/WinstoneAgentApi.kt");
    expect(k).not.toContain('put("assign", true)');
    expect(k).not.toContain('put("agent_id", agentId)');
  });
});

describe("P2-3 outcome retries are idempotent per agent + call_uid", () => {
  it("uses the atomic receipt function and never updates the lead directly", async () => {
    const res = await post(OutcomeRoute, { lead_id: LEAD, outcome: "interested", notes: "n", call_uid: "call-0001-abcd" });
    expect(res.status).toBe(200);
    expect(s.rpc).toHaveLength(1);
    expect(s.rpc[0]).toMatchObject({ fn: "apply_phone_outcome_atomic", args: { _agent: "agent-a", _call_uid: "call-0001-abcd", _lead: LEAD } });
    expect(s.leadUpdates).toBe(0);
    expect(s.events).toBe(0);
    expect((await res.json()).idempotent).toBe(true);
  });
  it("a replay returns the stored result flagged duplicate", async () => {
    s.rpcResult = { data: { ok: true, duplicate: true, status: "contacted" }, error: null };
    const body = await (await post(OutcomeRoute, { lead_id: LEAD, outcome: "interested", call_uid: "call-0001-abcd" })).json();
    expect(body.duplicate).toBe(true);
  });
  it("call_uid reused for a different lead is a 409", async () => {
    s.rpcResult = { data: null, error: { message: "call_uid already used for another lead" } };
    expect((await post(OutcomeRoute, { lead_id: LEAD, outcome: "interested", call_uid: "call-0001-abcd" })).status).toBe(409);
  });
  it("legacy payloads without call_uid are applied once and flagged non-idempotent", async () => {
    const res = await post(OutcomeRoute, { lead_id: LEAD, outcome: "no_answer" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ idempotent: false, legacy: true });
    expect(s.rpc).toHaveLength(0);
    expect(s.leadUpdates).toBe(1);
  });
  it("rejects malformed call_uid", async () => {
    expect((await post(OutcomeRoute, { lead_id: LEAD, outcome: "interested", call_uid: "bad uid!" })).status).toBe(400);
  });
  it("Android generates the call_uid once at enqueue and sends it on every retry", () => {
    const q = src("android/app/src/main/java/com/winstone/connect/data/sync/CallSyncQueue.kt");
    expect(q).toContain('unique = "out_$uid"');
    expect(q).toContain(".putString(KEY_CALL_UID, uid)");
    expect(q).toMatch(/postCallOutcome\([\s\S]*callUid = inputData\.getString\(CallSyncQueue\.KEY_CALL_UID\)/);
  });
  it("receipt table is server-only and the function is not callable by app roles", () => {
    const m = src("drizzle/migrations/0137_atomic_report_finalize_and_outcome_receipts.sql");
    expect(m).toContain("UNIQUE (agent_id, call_uid)");
    expect(m).toContain("REVOKE ALL ON FUNCTION public.apply_phone_outcome_atomic(uuid,uuid,text,text,text,text,boolean) FROM PUBLIC, anon, authenticated");
    expect(m).not.toMatch(/GRANT [^;]*phone_outcome_receipts TO (anon|authenticated)/);
  });
});

describe("P2-4 sign-out revokes only this phone's token", () => {
  it("revokes by this token's hash and only unrevoked rows", async () => {
    const res = await post(LogoutRoute, {}, { "x-device-token": "t".repeat(40) });
    expect(res.status).toBe(200);
    expect(s.revokeFilters).toEqual([["token_hash", `hash:${"t".repeat(40)}`], ["revoked_at", null]]);
    expect((await res.json()).revoked).toBe(true);
  });
  it("missing token is a no-op success (never revokes other devices)", async () => {
    const res = await post(LogoutRoute, {});
    expect((await res.json()).revoked).toBe(false);
    expect(s.revokeFilters).toEqual([]);
  });
  it("Android stores the token only in Keystore-backed storage and signs out remotely", () => {
    const a = src("android/app/src/main/java/com/winstone/connect/data/AgentSession.kt");
    expect(a).not.toContain(".putString(M_DEVICE_TOKEN");
    expect(a).not.toContain("it[DEVICE_TOKEN] = token");
    expect(a).toContain("SecureTokenStore.write(context, token)");
    expect(a).toContain("SessionRules.isSignedIn(employeeId, deviceToken)");
    expect(src("android/app/src/main/java/com/winstone/connect/data/SecureTokenStore.kt")).toContain("EncryptedSharedPreferences.create(");
    expect(src("android/app/src/main/java/com/winstone/connect/ui/DeskViewModel.kt")).toMatch(/WinstoneApi\.logout\(it\)[\s\S]*AgentSession\.clear\(app\)/);
    expect(src("android/app/build.gradle.kts")).toContain("androidx.security:security-crypto");
  });
  it("queued jobs are stamped with their account and checked before sending", () => {
    const q = src("android/app/src/main/java/com/winstone/connect/data/sync/CallSyncQueue.kt");
    expect(q).toContain(".putString(KEY_OWNER, AgentSession.employeeIdNow(context))");
    expect(q).toContain("QueueOwnership.Decision.DROP -> return Result.failure()");
  });
});

describe("P1-1 report finalization is one transaction", () => {
  const ts = src("src/lib/call-reports.server.ts");
  const sql = src("drizzle/migrations/0137_atomic_report_finalize_and_outcome_receipts.sql");
  it("submit goes through finalize_call_report_v2, with no separate status/lead/classification writes", () => {
    expect(ts).toContain('rpc("finalize_call_report_v2"');
    expect(ts).not.toMatch(/from\("call_reports"\)\s*\.update\(\{\s*status: "submitted"/);
    expect(ts).not.toMatch(/from\("lead_classifications"\)\.insert/);
    expect(ts).not.toContain("_key: crypto.randomUUID()");
  });
  it("function locks the report, returns alreadySubmitted, and sets submitted last", () => {
    expect(sql).toMatch(/FROM public\.call_reports WHERE id=_report FOR UPDATE/);
    expect(sql).toContain("IF r.status='submitted' THEN RETURN jsonb_build_object('alreadySubmitted',true)");
    const statusAt = sql.indexOf("UPDATE public.call_reports SET status='submitted'");
    expect(statusAt).toBeGreaterThan(sql.indexOf("create_report_follow_up_atomic"));
    expect(statusAt).toBeGreaterThan(sql.indexOf("INSERT INTO public.lead_classifications"));
    expect(statusAt).toBeGreaterThan(sql.indexOf("'outcome_logged'"));
  });
  it("follow-up completion reuses the append-only transition with deterministic keys", () => {
    expect(sql).toContain("public.transition_follow_up_atomic(e.id, _agent, 'complete'");
    expect(sql).toContain("md5('report-complete:'||_report::text||':'||e.id::text)::uuid");
    expect(sql).not.toMatch(/DELETE FROM/i);
  });
  it("is executable by the server role only", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.finalize_call_report_v2(uuid,uuid,jsonb,jsonb,jsonb,text,text,boolean,text,text,jsonb) FROM PUBLIC, anon, authenticated");
  });
});
