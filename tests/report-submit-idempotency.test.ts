/**
 * Repeated taps / automatic retries of one call report: the lead is advanced
 * at most once, and follow-on steps (call facts, phone sync trail, sheet copy,
 * review alerts, next queued report) run only for the request that committed.
 * The database transaction itself is covered by tests/sql/finalize-and-outcome.test.sql.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({
  reportStatus: "pending" as "pending" | "submitted",
  /** What finalize_call_report_v2 answers: first caller commits, later callers see it submitted. */
  committed: false,
  rpcCalls: 0,
  leadAdvances: 0,
  writes: [] as string[],
  sideEffects: [] as string[],
}));

vi.mock("@/integrations/supabase/client.server", () => {
  const chain = (table: string) => {
    const c: Record<string, unknown> = {};
    const self = () => c;
    for (const m of ["select", "eq", "neq", "in", "is", "not", "gte", "lte", "lt", "gt", "or", "order", "limit", "range"]) c[m] = self;
    c.update = () => { s.writes.push(`update:${table}`); return c; };
    c.insert = () => { s.writes.push(`insert:${table}`); return c; };
    c.upsert = () => { s.writes.push(`upsert:${table}`); return c; };
    c.maybeSingle = async () => {
      if (table === "call_reports")
        return { data: { id: "report-1", agent_id: "agent-1", lead_id: "lead-1", recording_id: "rec-1", device_id: null, status: s.reportStatus, connected: false, duration_seconds: 0, channel: "call", created_at: "2026-10-31T06:00:00Z" }, error: null };
      if (table === "leads") return { data: { assigned_to: "agent-1", assigned_agent_id: "agent-1", unanswered_attempts: 0, notes: null }, error: null };
      return { data: null, error: null };
    };
    c.single = c.maybeSingle;
    c.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
    return c;
  };
  return {
    supabaseAdmin: {
      from: chain,
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (fn !== "finalize_call_report_v2") return { data: null, error: null };
        s.rpcCalls++;
        // Row lock inside the function: only one request ever commits.
        if (s.committed) return { data: { alreadySubmitted: true }, error: null };
        s.committed = true;
        if (args._lead_patch) s.leadAdvances++;
        return { data: { alreadySubmitted: false, reassigned: false, followUpId: null }, error: null };
      },
    },
  };
});
// Never reach a real database from this test.
vi.mock("@/integrations/supabase/client", () => ({ supabase: new Proxy({}, { get: (_t, k) => { throw new Error(`browser client used: ${String(k)}`); } }) }));
vi.mock("@/lib/call-jobs.server", () => ({ recordSyncEvent: async () => { s.sideEffects.push("sync_event"); } }));
vi.mock("@/lib/classification-review.server", () => ({ reviewSubmittedReport: async () => { s.sideEffects.push("review"); return { mismatchAlertId: null, missingRecordingAlertId: null }; } }));
vi.mock("@/lib/report-sheet.server", () => ({ syncReportsToSheet: async () => { s.sideEffects.push("sheet"); return { appended: 1 }; } }));
vi.mock("@/lib/audit.server", () => ({ logAudit: async () => undefined }));

const payload = {
  reportId: "report-1",
  agentId: "agent-1",
  category: "no_answer",
  summary: "ধরেননি",
  callStatus: "no_answer",
  direction: "outgoing",
  durationSeconds: 0,
  followUpAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
};

// Vitest can hand a concurrent first dynamic import the real module instead of
// the mock, so every mocked module is loaded once before any parallel submit.
beforeAll(async () => {
  for (const m of [
    () => import("@/integrations/supabase/client.server"),
    () => import("@/integrations/supabase/client"),
    () => import("@/lib/call-jobs.server"),
    () => import("@/lib/classification-review.server"),
    () => import("@/lib/report-sheet.server"),
    () => import("@/lib/audit.server"),
  ]) await m();
  const real = await import("@/integrations/supabase/client.server");
  if (!("rpc" in real.supabaseAdmin) || typeof (real.supabaseAdmin as { auth?: unknown }).auth !== "undefined") throw new Error("real database client loaded — refusing to run");
});

beforeEach(() => {
  s.reportStatus = "pending";
  s.committed = false;
  s.rpcCalls = 0;
  s.leadAdvances = 0;
  s.writes = [];
  s.sideEffects = [];
});

describe("call report retries are idempotent", () => {
  it("two simultaneous submits of one report advance the lead once and run follow-on steps once", async () => {
    const { submitCallReport } = await import("@/lib/call-reports.server");
    const [a, b] = await Promise.all([submitCallReport(payload as never), submitCallReport(payload as never)]);
    expect(s.rpcCalls).toBe(2);
    expect(s.leadAdvances).toBe(1);
    expect([a, b].filter((r) => (r as { alreadySubmitted?: boolean }).alreadySubmitted)).toHaveLength(1);
    expect(s.sideEffects.filter((x) => x === "sync_event")).toHaveLength(1);
    expect(s.sideEffects.filter((x) => x === "sheet")).toHaveLength(1);
    expect(s.sideEffects.filter((x) => x === "review")).toHaveLength(1);
    expect(s.writes.filter((w) => w === "update:call_recordings")).toHaveLength(1);
  });

  it("a retry after the report was saved returns success and changes nothing", async () => {
    s.reportStatus = "submitted";
    const { submitCallReport } = await import("@/lib/call-reports.server");
    expect(await submitCallReport(payload as never)).toMatchObject({ ok: true, alreadySubmitted: true });
    expect(s.rpcCalls).toBe(0);
    expect(s.writes).toEqual([]);
    expect(s.sideEffects).toEqual([]);
  });
});

describe("web form sends one request at a time", () => {
  it("repeated taps while saving share the same request", async () => {
    const { singleFlight } = await import("@/lib/single-flight");
    let sends = 0;
    let release!: () => void;
    const run = singleFlight(() => new Promise<string>((r) => { sends++; release = () => r("ok"); }));
    const taps = [run(), run(), run()];
    release();
    expect(await Promise.all(taps)).toEqual(["ok", "ok", "ok"]);
    expect(sends).toBe(1);
    // After it settles, a real retry may send again.
    const again = run();
    release();
    await again;
    expect(sends).toBe(2);
  });

  it("a failed request can be retried", async () => {
    const { singleFlight } = await import("@/lib/single-flight");
    let n = 0;
    const run = singleFlight(async () => { n++; if (n === 1) throw new Error("Failed to fetch"); return "ok"; });
    await expect(run()).rejects.toThrow("Failed to fetch");
    expect(await run()).toBe("ok");
  });
});
