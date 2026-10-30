import { describe, expect, it, vi } from "vitest";

import type { ApiCaller } from "@/lib/device-auth.server";
import { handleReportsSummary, type OwnReportData } from "@/lib/reports-summary.server";

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

  it("refuses the shared server secret path", async () => {
    const { res, loadOwnData } = call("", { kind: "server" });
    expect((await res).status).toBe(401);
    expect(loadOwnData).not.toHaveBeenCalled();
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

describe("loadOwnReportData query scoping (fake query client)", () => {
  it("filters every table by the caller and drops leads owned by someone else", async () => {
    const { loadOwnReportData } = await import("@/lib/reports-summary.server");
    const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
    const rows: Record<string, unknown[]> = {
      leads: [
        { id: "l1", assigned_to: AGENT.id, assigned_agent_id: AGENT.id },
        { id: "l2", assigned_to: OTHER_ID, assigned_agent_id: AGENT.id },
        { id: "l3", assigned_to: null, assigned_agent_id: AGENT.id },
      ],
      call_recordings: [],
      whatsapp_interactions: [],
    };
    const client = {
      from(table: string) {
        const b: any = {
          select: (...a: unknown[]) => (calls.push({ table, op: "select", args: a }), b),
          or: (...a: unknown[]) => (calls.push({ table, op: "or", args: a }), Promise.resolve({ data: rows[table] })),
          eq: (...a: unknown[]) => (calls.push({ table, op: "eq", args: a }), b),
          gte: (...a: unknown[]) => (calls.push({ table, op: "gte", args: a }), Promise.resolve({ data: rows[table] })),
        };
        return b;
      },
    };
    const out = await loadOwnReportData(AGENT.id, "2026-10-01T00:00:00Z", client);
    expect(out.leads.map((l) => l.id)).toEqual(["l1", "l3"]);
    expect(calls).toContainEqual({ table: "leads", op: "or", args: [`assigned_to.eq.${AGENT.id},assigned_agent_id.eq.${AGENT.id}`] });
    expect(calls).toContainEqual({ table: "call_recordings", op: "eq", args: ["agent_id", AGENT.id] });
    expect(calls).toContainEqual({ table: "whatsapp_interactions", op: "eq", args: ["agent_id", AGENT.id] });
    await expect(loadOwnReportData("x,assigned_to.neq.0", "2026-10-01T00:00:00Z", client)).rejects.toThrow();
  });
});
