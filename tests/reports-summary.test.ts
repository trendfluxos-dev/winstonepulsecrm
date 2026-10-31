import { describe, expect, it, vi } from "vitest";

import type { ApiCaller } from "@/lib/device-auth.server";
import { handleReportsSummary, loadOwnReportData, type OwnReportData } from "@/lib/reports-summary.server";

const AGENT = { id: "11111111-1111-4111-8111-111111111111", employee_id: "WIN2601", role: "agent", full_name: "A" };
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

function deviceCaller(profile: Record<string, unknown> = AGENT): ApiCaller {
  return { kind: "device", device: { id: "d1" } as never, profile: profile as never };
}

function call(url: string, caller: ApiCaller, loader?: (id: string, from: string) => Promise<OwnReportData>) {
  const loadOwnData = vi.fn(loader ?? (async () => ({ leads: [], calls: [], messages: [] })));
  const res = handleReportsSummary(new Request(`https://crm.winstonebd.com/api/public/reports/summary${url}`), {
    resolveCaller: async () => caller,
    loadOwnData,
    now: () => new Date("2026-10-30T12:00:00Z"),
  });
  return { res, loadOwnData };
}

describe("reports summary handler (mocked resolver result)", () => {
  it("rejects unauthenticated callers", async () => {
    const { res, loadOwnData } = call("", { kind: "none" });
    expect((await res).status).toBe(401);
    expect(loadOwnData).not.toHaveBeenCalled();
  });

  it("rejects invalid or revoked tokens (resolver returns none)", async () => {
    expect((await call("", { kind: "none" }).res).status).toBe(401);
  });

  it("forbids asking for another agent by id or employee id", async () => {
    expect((await call(`?agent_id=${OTHER_ID}`, deviceCaller()).res).status).toBe(403);
    expect((await call("?employee_id=WIN2699", deviceCaller()).res).status).toBe(403);
  });

  it("denies non-agent roles instead of widening to company data", async () => {
    const { res, loadOwnData } = call("", deviceCaller({ ...AGENT, role: "admin" }));
    expect((await res).status).toBe(403);
    expect(loadOwnData).not.toHaveBeenCalled();
  });

  it("validates date ranges", async () => {
    expect((await call("?from=2026-10-10&to=2026-10-01", deviceCaller()).res).status).toBe(400);
    expect((await call("?from=2026-01-01&to=2026-10-01", deviceCaller()).res).status).toBe(400);
    expect((await call("?from=2026-02-31&to=2026-03-01", deviceCaller()).res).status).toBe(400);
    expect((await call("?role=admin", deviceCaller()).res).status).toBe(400);
  });

  it("returns only the caller's own scoped report", async () => {
    const { res, loadOwnData } = call(`?employee_id=WIN2601&agent_id=${AGENT.id}`, deviceCaller());
    const r = await res;
    expect(r.status).toBe(200);
    expect(loadOwnData).toHaveBeenCalledWith(AGENT.id, expect.stringMatching(/T00:00:00Z$/));
    const body = await r.json();
    expect(body.scope).toBe("own");
    expect(body.agents).toBeUndefined();
    expect(body.me?.agentId).toBe(AGENT.id);
  });

  it("hides loader error details", async () => {
    const r = await call("", deviceCaller(), async () => {
      throw new Error("secret db detail");
    }).res;
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("secret db detail");
  });
});

function fakeClient(rows: Record<string, unknown[]>, failTable?: string) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const b: any = {};
      for (const op of ["select", "or", "eq", "gte", "order"]) {
        b[op] = (...a: unknown[]) => (calls.push({ table, op, args: a }), b);
      }
      b.range = (from: number, to: number) => {
        calls.push({ table, op: "range", args: [from, to] });
        if (table === failTable) return Promise.resolve({ data: null, error: { message: "boom" } });
        return Promise.resolve({ data: (rows[table] ?? []).slice(from, to + 1), error: null });
      };
      return b;
    },
  };
  return { client, calls };
}

describe("loadOwnReportData query scoping (fake query client)", () => {
  it("filters every table by the caller and drops leads owned by someone else", async () => {
    const { client, calls } = fakeClient({
      leads: [
        { id: "l1", assigned_to: AGENT.id, assigned_agent_id: AGENT.id },
        { id: "l2", assigned_to: OTHER_ID, assigned_agent_id: AGENT.id },
        { id: "l3", assigned_to: null, assigned_agent_id: AGENT.id },
      ],
    });
    const out = await loadOwnReportData(AGENT.id, "2026-10-01T00:00:00Z", client);
    expect(out.leads.map((l) => l.id)).toEqual(["l1", "l3"]);
    expect(calls).toContainEqual({ table: "leads", op: "or", args: [`assigned_agent_id.eq.${AGENT.id},assigned_to.eq.${AGENT.id}`] });
    expect(calls).toContainEqual({ table: "call_recordings", op: "eq", args: ["agent_id", AGENT.id] });
    expect(calls).toContainEqual({ table: "whatsapp_interactions", op: "eq", args: ["agent_id", AGENT.id] });
    await expect(loadOwnReportData("x,assigned_to.neq.0", "2026-10-01T00:00:00Z", client)).rejects.toThrow();
  });

  it("reads past 1,000 rows instead of truncating totals", async () => {
    const leads = Array.from({ length: 1500 }, (_, i) => ({ id: `l${i}`, assigned_to: AGENT.id }));
    const calls = Array.from({ length: 2300 }, (_, i) => ({ id: `c${i}`, agent_id: AGENT.id }));
    const { client } = fakeClient({ leads, call_recordings: calls });
    const out = await loadOwnReportData(AGENT.id, "2026-10-01T00:00:00Z", client);
    expect(out.leads).toHaveLength(1500);
    expect(out.calls).toHaveLength(2300);
  });

  it("fails the whole read when any page errors", async () => {
    const { client } = fakeClient({}, "whatsapp_interactions");
    await expect(loadOwnReportData(AGENT.id, "2026-10-01T00:00:00Z", client)).rejects.toThrow("report read failed");
  });
});

describe("own-id hints", () => {
  it("accepts the caller's own id in upper case", async () => {
    expect((await call(`?agent_id=${AGENT.id.toUpperCase()}`, deviceCaller()).res).status).toBe(200);
  });

  it("accepts a stored own id that is not RFC-variant strict", async () => {
    const legacy = { ...AGENT, id: "00000000-0000-0000-0000-000000000001" };
    expect((await call(`?agent_id=${legacy.id}`, deviceCaller(legacy)).res).status).toBe(200);
  });

  it("rejects malformed agent ids before any read", async () => {
    const { res, loadOwnData } = call("?agent_id=not-a-uuid", deviceCaller());
    expect((await res).status).toBe(400);
    expect(loadOwnData).not.toHaveBeenCalled();
  });
});
