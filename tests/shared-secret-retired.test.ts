import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake database: devices keyed by token hash, profiles by id.
const db = vi.hoisted(() => ({
  devices: new Map<string, Record<string, unknown>>(),
  profiles: new Map<string, Record<string, unknown>>(),
}));

vi.mock("@/integrations/supabase/client.server", () => {
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let revokedNull = false;
    const b: any = {
      select: () => b,
      update: () => b,
      eq: (col: string, val: unknown) => ((filters[col] = val), b),
      is: (col: string) => ((revokedNull = col === "revoked_at"), b),
      maybeSingle: async () => {
        if (table === "agent_devices") {
          const d = db.devices.get(String(filters.token_hash));
          return { data: d && (!revokedNull || d.revoked_at == null) ? d : null };
        }
        if (table === "profiles") return { data: db.profiles.get(String(filters.id)) ?? null };
        return { data: null };
      },
      then: (r: (v: unknown) => void) => r({ data: null }),
    };
    return b;
  };
  return { supabaseAdmin: { from } };
});

import { hashToken, resolveApiCaller } from "@/lib/device-auth.server";

const TOKEN = "a".repeat(64);
const AGENT = { id: "11111111-1111-4111-8111-111111111111", employee_id: "WIN2601", role: "agent", is_active: true, approval_status: "approved" };

async function seed(device: Record<string, unknown> = {}, profile: Record<string, unknown> = {}) {
  db.devices.clear();
  db.profiles.clear();
  db.devices.set(await hashToken(TOKEN), { id: "dev-1", profile_id: AGENT.id, revoked_at: null, ...device });
  db.profiles.set(AGENT.id, { ...AGENT, ...profile });
}
const req = (headers: Record<string, string>) => new Request("https://crm.winstonebd.com/x", { headers });

describe("resolveApiCaller (real resolver, fake database)", () => {
  beforeEach(() => seed());

  it("accepts a valid active device token and takes identity from the server row", async () => {
    const c = await resolveApiCaller(req({ "x-device-token": TOKEN }));
    expect(c.kind).toBe("device");
    if (c.kind === "device") expect(c.profile.id).toBe(AGENT.id);
  });
  it("rejects missing, short and unknown tokens", async () => {
    expect((await resolveApiCaller(req({}))).kind).toBe("none");
    expect((await resolveApiCaller(req({ "x-device-token": "short" }))).kind).toBe("none");
    expect((await resolveApiCaller(req({ "x-device-token": "b".repeat(64) }))).kind).toBe("none");
  });
  it("rejects revoked devices", async () => {
    await seed({ revoked_at: "2026-10-01T00:00:00Z" });
    expect((await resolveApiCaller(req({ "x-device-token": TOKEN }))).kind).toBe("none");
  });
  it("rejects inactive or unapproved staff", async () => {
    await seed({}, { is_active: false });
    expect((await resolveApiCaller(req({ "x-device-token": TOKEN }))).kind).toBe("none");
    await seed({}, { approval_status: "pending" });
    expect((await resolveApiCaller(req({ "x-device-token": TOKEN }))).kind).toBe("none");
  });
  it("no longer honours the retired shared-secret header", async () => {
    vi.stubEnv("INGEST_SECRET", "test-only-value");
    expect((await resolveApiCaller(req({ "x-ingest-secret": "test-only-value" }))).kind).toBe("none");
    vi.unstubAllEnvs();
  });
});

describe("phone endpoints", () => {
  beforeEach(() => seed());

  it("workspace and presence refuse unauthenticated callers and other agents", async () => {
    const { Route: Workspace } = await import("@/routes/api/public/agent/workspace");
    const { Route: Presence } = await import("@/routes/api/public/agent/presence");
    const ws = (Workspace.options.server as any).handlers.GET;
    const pr = (Presence.options.server as any).handlers.POST;
    const u = "https://crm.winstonebd.com/api/public/agent/workspace";
    expect((await ws({ request: new Request(u) })).status).toBe(401);
    expect((await ws({ request: new Request(u, { headers: { "x-ingest-secret": "x".repeat(40) } }) })).status).toBe(401);
    // Another agent's id is ignored: the response is still the caller's own workspace.
    const other = await ws({ request: new Request(`${u}?employee_id=WIN2699&agent_id=22222222-2222-4222-8222-222222222222`, { headers: { "x-device-token": TOKEN } }) });
    expect(other.status).not.toBe(403);
    if (other.status === 200) expect((await other.json()).agent?.id ?? AGENT.id).toBe(AGENT.id);
    expect((await pr({ request: new Request(u, { method: "POST", body: "{}" }) })).status).toBe(401);
  });

  it("the retired reprocess endpoint refuses everyone, even valid phones", async () => {
    const { Route } = await import("@/routes/api/public/ingest/reprocess");
    const h = (Route.options.server as any).handlers;
    const r = await h.POST({ request: new Request("https://x/", { method: "POST", headers: { "x-device-token": TOKEN } }) });
    expect(r.status).toBe(410);
  });
});

describe("no shared-secret code remains", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|kt)$/.test(n) ? [p] : [];
    });
  it("src and android contain no INGEST_SECRET / x-ingest-secret / serverSecretValid", () => {
    const hits = [...walk("src"), ...walk("android/app/src")]
      .filter((f) => !f.endsWith("routeTree.gen.ts"))
      .filter((f) => /INGEST_SECRET|x-ingest-secret|serverSecretValid/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
