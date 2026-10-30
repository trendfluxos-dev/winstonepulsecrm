import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ calls: [] as string[], scope: "full" as string }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b = { inputValidator: () => b, handler: (fn: unknown) => fn };
    return b;
  },
}));
vi.mock("@/lib/admin-gate.server", () => ({
  requireAdminToken: (t: string) => {
    if (!t || t !== "valid-full" || m.scope !== "full") throw new Error("Admin PIN required");
  },
}));
vi.mock("@/lib/paddle.server", () => ({
  gatewayFetch: async (env: string, path: string) => {
    m.calls.push(`${env} ${path}`);
    return new Response(JSON.stringify({ data: [{ id: "pri_01abc" }] }), { status: 200 });
  },
}));

import { resolvePaddlePrice } from "@/lib/payments.functions";
const call = (data: unknown) => (resolvePaddlePrice as unknown as (a: { data: unknown }) => Promise<string>)({ data });
const ok = { plan: "pro_monthly", environment: "live", adminToken: "valid-full" };

beforeEach(() => {
  m.calls = [];
  m.scope = "full";
});

describe("Paddle price lookup is gated and allowlisted", () => {
  it("rejects anonymous callers before contacting Paddle", async () => {
    await expect(call({ plan: "pro_monthly", environment: "live" })).rejects.toThrow();
    expect(m.calls).toEqual([]);
  });
  it("rejects an invalid or non-full PIN session", async () => {
    await expect(call({ ...ok, adminToken: "forged" })).rejects.toThrow("Admin PIN required");
    m.scope = "hq";
    await expect(call(ok)).rejects.toThrow("Admin PIN required");
    expect(m.calls).toEqual([]);
  });
  it("rejects arbitrary plan or raw Paddle price ids", async () => {
    await expect(call({ ...ok, plan: "pri_attacker" })).rejects.toThrow();
    await expect(call({ ...ok, priceId: "pri_attacker" })).rejects.toThrow();
    expect(m.calls).toEqual([]);
  });
  it("rejects an invalid environment", async () => {
    await expect(call({ ...ok, environment: "production" })).rejects.toThrow();
    expect(m.calls).toEqual([]);
  });
  it("allows the full-PIN lookup of the allowlisted plan only", async () => {
    await expect(call(ok)).resolves.toBe("pri_01abc");
    expect(m.calls).toEqual(["live /prices?external_id=pro_monthly"]);
  });
});
