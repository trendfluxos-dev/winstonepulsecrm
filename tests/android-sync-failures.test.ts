import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NEXT_STEP,
  SYNC_ERROR_KINDS,
  formatDhaka,
  summarizeSyncFailures,
  toSyncFailureEvent,
  type SyncFailureRow,
} from "@/lib/android-sync-failures";

const names = new Map([["agent-a", "Rahim"], ["agent-b", "Karim"]]);
const versions = new Map([["dev-a", "2.22"], ["dev-b", "2.22"]]);
const row = (over: Partial<SyncFailureRow> & { payload?: Record<string, unknown> }): SyncFailureRow => ({
  id: crypto.randomUUID(), agent_id: "agent-a", device_id: "dev-a", created_at: "2026-11-01T06:30:00.000Z",
  ...over,
  payload: { item_kind: "recording", error_kind: "NETWORK", http_status: null, attempts: 3, count: 1, permanent: false,
    call_ref: "a1b2c3d4e5f6", first_at: "2026-11-01T06:00:00.000Z", last_at: "2026-11-01T06:25:30.000Z", ...(over.payload ?? {}) },
});

describe("Android sync failure summary", () => {
  it("groups by error type and agent, with counts, agents affected and next steps", () => {
    const ev = [
      row({ payload: { error_kind: "NETWORK", count: 4 } }),
      row({ agent_id: "agent-b", device_id: "dev-b", payload: { error_kind: "NETWORK" } }),
      row({ payload: { error_kind: "ACCESS_DENIED", permanent: true, http_status: 403, last_at: "2026-11-01T07:00:00.000Z" } }),
    ].map((r) => toSyncFailureEvent(r, names, versions));
    const s = summarizeSyncFailures(ev);
    expect(s.failures).toBe(6);
    expect(s.permanent).toBe(1);
    expect(s.agentsAffected).toBe(2);
    expect(s.kinds[0]).toMatchObject({ kind: "NETWORK", failures: 5, agents: 2, permanent: false });
    expect(s.kinds[1]).toMatchObject({ kind: "ACCESS_DENIED", failures: 1, permanent: true });
    expect(s.kinds[1]!.step).toContain("LeadHub");
    // Agent with a permanent problem is listed first.
    expect(s.agents[0]).toMatchObject({ agentName: "Rahim", failures: 5, permanent: 1, appVersion: "2.22" });
    expect(s.agents[0]!.lastAtUtc).toBe("2026-11-01T07:00:00.000Z");
  });

  it("every error kind has a label and a next step", () => {
    for (const k of SYNC_ERROR_KINDS) {
      expect(NEXT_STEP[k].label.length).toBeGreaterThan(3);
      expect(NEXT_STEP[k].step.length).toBeGreaterThan(10);
    }
  });

  it("shows Dhaka time and keeps raw UTC", () => {
    const e = toSyncFailureEvent(row({}), names, versions);
    expect(e.lastAtUtc).toBe("2026-11-01T06:25:30.000Z");
    expect(formatDhaka(e.lastAtUtc)).toContain("12:25:30");
  });

  it("unknown or unsafe stored values are never trusted", () => {
    const e = toSyncFailureEvent(row({ agent_id: null, device_id: null, payload: { error_kind: "DROP TABLE", item_kind: "x", call_ref: "01711223344", http_status: 9999 } }), names, versions);
    expect(e).toMatchObject({ errorKind: "UNKNOWN", itemKind: "other", callRef: null, agentName: "Unknown agent", appVersion: "Unknown", httpStatus: 599 });
  });
});

// ---- device endpoint + admin read (all database calls mocked) ----
const s = vi.hoisted(() => ({
  caller: { kind: "device", profile: { id: "agent-a" }, device: { id: "dev-a" } } as Record<string, unknown>,
  upserts: [] as Array<{ rows: Array<Record<string, unknown>>; opts: unknown }>,
  scope: "authority",
  from: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (v: unknown) => v }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { inputValidator: (v: (i: unknown) => unknown) => ({ handler: (fn: (a: { data: unknown }) => unknown) => (a: { data: unknown }) => fn({ data: v(a.data) }) }) };
  return chain;
} }));
vi.mock("@/lib/device-auth.server", () => ({ resolveApiCaller: async () => s.caller }));
vi.mock("@/lib/access.server", () => ({
  resolveCaller: async () => ({ scope: s.scope }),
  requireAuthority: (c: { scope: string }) => { if (c.scope !== "authority") throw new Error("Master PIN required"); },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (t: string) => s.from(t) } }));

import { Route } from "@/routes/api/public/agent/sync-failures";
import { listAndroidSyncFailures } from "@/lib/android-sync-failures.functions";

type R = { server: { handlers: { POST: (v: { request: Request }) => Promise<Response> } } };
const post = (body: unknown) => (Route as unknown as R).server.handlers.POST({
  request: new Request("https://x.test/api/public/agent/sync-failures", { method: "POST", body: JSON.stringify(body) }),
});
const failure = { id: "f-0001-abcd", item_kind: "recording", error_kind: "SERVER_ERROR", http_status: 503, attempts: 4, count: 2,
  permanent: false, call_ref: "a1b2c3d4e5f6", first_at: "2026-11-01T06:00:00Z", last_at: "2026-11-01T06:10:00Z" };

beforeEach(() => {
  s.caller = { kind: "device", profile: { id: "agent-a" }, device: { id: "dev-a" } };
  s.upserts = []; s.scope = "authority"; s.from.mockReset();
  s.from.mockImplementation(() => ({ upsert: async (rows: Array<Record<string, unknown>>, opts: unknown) => { s.upserts.push({ rows, opts }); return { error: null }; } }));
});

describe("phone sync-failure endpoint", () => {
  it("refuses callers without a device token", async () => {
    s.caller = { kind: "none" };
    expect((await post({ failures: [failure] })).status).toBe(401);
    expect(s.upserts).toHaveLength(0);
  });
  it("stores under the token's agent and device, ignoring re-sent ids", async () => {
    const res = await post({ failures: [{ ...failure, agent_id: "agent-b" }] });
    expect(res.status).toBe(200);
    const r = s.upserts[0]!.rows[0]!;
    expect(r).toMatchObject({ agent_id: "agent-a", device_id: "dev-a", event_type: "android_sync_failure", status: "failed",
      idempotency_key: "android_sync_failure:dev-a:f-0001-abcd" });
    expect(s.upserts[0]!.opts).toMatchObject({ onConflict: "idempotency_key", ignoreDuplicates: true });
    expect(JSON.stringify(r.payload)).not.toContain("agent-b");
  });
  it("rejects personal data and unknown kinds", async () => {
    expect((await post({ failures: [{ ...failure, call_ref: "01711223344" }] })).status).toBe(400);
    expect((await post({ failures: [{ ...failure, error_kind: "WHATEVER" }] })).status).toBe(400);
    expect((await post({ failures: [] })).status).toBe(400);
    expect(s.upserts).toHaveLength(0);
  });
});

describe("admin sync-failure view", () => {
  const input = { fromIso: "2026-10-25T00:00:00.000Z", toIso: "2026-11-01T00:00:00.000Z" };
  it.each(["agent", "coordinator", "none"])("denies %s before any database read", async (scope) => {
    s.scope = scope;
    await expect((listAndroidSyncFailures as unknown as (a: { data: unknown }) => Promise<unknown>)({ data: input })).rejects.toThrow("Master PIN required");
    expect(s.from).not.toHaveBeenCalled();
  });
  it("reads only failed android_sync_failure rows (select only, no writes)", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lt", "order", "in"]) q[m] = (...a: unknown[]) => { calls.push([m, ...a]); return q; };
    q.limit = async () => ({ data: [row({})], error: null });
    q.then = (fn: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: "agent-a", name: "Rahim", app_version: "2.22" }], error: null }).then(fn);
    s.from.mockReturnValue(q);
    const r = await (listAndroidSyncFailures as unknown as (a: { data: unknown }) => Promise<{ events: Array<{ agentName: string }> }>)({ data: input });
    expect(calls).toContainEqual(["eq", "status", "failed"]);
    expect(calls).toContainEqual(["eq", "event_type", "android_sync_failure"]);
    expect(calls.map((c) => c[0])).not.toContain("insert");
    expect(r.events[0]!.agentName).toBe("Rahim");
  });
});
