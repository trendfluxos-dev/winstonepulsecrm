import { beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({ updateFails: false, syncEvents: 0, reports: 0, patches: [] as Array<Record<string, unknown>> }));

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (opts: unknown) => ({ options: opts }) }));
vi.mock("@/lib/device-auth.server", () => ({
  resolveApiCaller: async () => ({ kind: "device", profile: { id: "agent-a", name: "Agent A", phone: null }, device: { id: "dev-a" } }),
}));
vi.mock("@/lib/lead-access.server", () => ({ leadNotAssignedTo: () => false, LEAD_NOT_YOURS: "not yours" }));
vi.mock("@/lib/call-jobs.server", () => ({ recordSyncEvent: async () => { s.syncEvents++; } }));
vi.mock("@/lib/lead-events.server", () => ({ logLeadEvent: async () => {} }));
vi.mock("@/lib/call-reports.server", () => ({ openCallReport: async () => { s.reports++; return { id: "report-a" }; } }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  let op = "select";
  const chain: Record<string, unknown> = {
    select: () => chain, eq: () => chain,
    update: (p: Record<string, unknown>) => { op = "update"; s.patches.push(p); return chain; },
    maybeSingle: async () => table === "leads"
      ? { data: { id: "11111111-1111-4111-8111-111111111111", phone_number: "01700000000", assigned_to: "agent-a", assigned_agent_id: "agent-a" }, error: null }
      : { data: { id: "rec-a", call_status: "answered", agent_id: "agent-a", lead_id: "11111111-1111-4111-8111-111111111111", storage_path: null, audio_url: null, upload_status: "pending", recording_status: "unknown" }, error: null },
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(op === "update" && s.updateFails ? { error: { message: "db down" } } : { error: null }).then(resolve),
  };
  return chain;
} } }));

import { Route } from "@/routes/api/public/agent/call-state";
type Handler = (a: { request: Request }) => Promise<Response>;
const post = (Route as unknown as { options: { server: { handlers: { POST: Handler } } } }).options.server.handlers.POST;
const call = (extra: Record<string, unknown> = {}) => post({ request: new Request("http://x/api/public/agent/call-state", { method: "POST", body: JSON.stringify({
  call_uid: "and-abc-1", lead_id: "11111111-1111-4111-8111-111111111111", state: "completed", at: "2026-11-01T04:00:00.000Z", duration_seconds: 42, ...extra,
}) }) });

beforeEach(() => { s.updateFails = false; s.syncEvents = 0; s.reports = 0; s.patches = []; });

describe("phone call-state acknowledgement", () => {
  it("returns 500 and writes nothing further when the call update fails, so the phone retries", async () => {
    s.updateFails = true;
    const res = await call();
    expect(res.status).toBe(500);
    expect(s.syncEvents).toBe(0);
    expect(s.reports).toBe(0);
  });
  it("acknowledges with 200 only after a successful update", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(s.reports).toBe(1);
  });
  it("stores call-history proof only when the phone sends it (app 2.21 never does)", async () => {
    const callRowPatches = () => s.patches.filter((p) => "call_status" in p);
    await call();
    expect(callRowPatches()[0]).not.toHaveProperty("talk_time_source");
    await call({ talk_time_source: "call_log" });
    expect(callRowPatches()[1]).toMatchObject({ talk_time_source: "call_log", duration_seconds: 42, call_status: "completed" });
  });
});
