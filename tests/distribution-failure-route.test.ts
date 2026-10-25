import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ fail: true, alertFail: false, friday: false, recorded: [] as unknown[], writes: 0 }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  const b = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: { value: { secret: "synthetic-cron" } } }) }; return b;
} } }));
vi.mock("@/lib/lead-pool.server", () => ({
  dhakaToday: () => "2026-10-25", rolloverPendingLeads: async () => 0,
  dailyPlan: async () => ({ perAgent: 50, lastRunDate: null }), usablePoolCount: async () => 500,
  distributeDailyLeads: async () => { m.writes++; if (m.fail) throw new Error("statement timeout private data"); return { moved: 50 }; },
  saveDailyPlan: async () => {},
}));
vi.mock("@/lib/business-day", () => ({ isDistributionDay: () => !m.friday }));
vi.mock("@/lib/distribution-failure.server", () => ({ recordDistributionFailure: async (_e: unknown, stage: string) => { m.recorded.push(stage); if (m.alertFail) throw new Error("private alert failure"); } }));
import { Route } from "@/routes/api/public/hooks/lead-distribution";
const invoke = (key = "synthetic-cron") => (Route as unknown as { server: { handlers: { POST: (arg: { request: Request }) => Promise<Response> } } }).server.handlers.POST({ request: new Request("https://example.test/api/public/hooks/lead-distribution", { method: "POST", headers: { "x-cron-secret": key } }) });
beforeEach(() => { m.fail = true; m.alertFail = false; m.friday = false; m.recorded = []; m.writes = 0; vi.spyOn(console, "error").mockImplementation(() => {}); });
describe("authenticated cron failure capture", () => {
  it("records failed assignment and returns safe reason, never raw exception", async () => {
    const r = await invoke(); expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "lead_distribution_failed", reason: "timeout", stage: "assign", alertSaved: true });
    expect(m.recorded).toEqual(["assign"]);
  });
  it("reports alert storage failure honestly while retaining failed response", async () => {
    m.alertFail = true; const r = await invoke(); expect(r.status).toBe(500); expect((await r.json()).alertSaved).toBe(false);
  });
  it("invalid credentials never distribute or generate incident alerts", async () => {
    expect((await invoke("wrong")).status).toBe(401); expect(m.writes).toBe(0); expect(m.recorded).toEqual([]);
  });
  it("Friday skip is not a failed distribution", async () => {
    m.friday = true; expect((await invoke()).status).toBe(200); expect(m.recorded).toEqual([]); expect(m.writes).toBe(0);
  });
  it("success never generates a failure alert", async () => {
    m.fail = false; expect((await invoke()).status).toBe(200); expect(m.recorded).toEqual([]);
  });
});