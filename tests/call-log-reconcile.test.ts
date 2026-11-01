import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { reconcileLateCallLog } from "@/lib/call-log-reconcile.server";
import { callLogReconcilePatch, pickCallLogMatch } from "@/lib/call-reconciliation";
import { isPhoneMeasuredCall, resolveCallDuration, resolveDurationSource } from "@/lib/call-duration";
import { verifyLeadFromCallEvidence } from "@/lib/lead-verification";

type Row = Record<string, unknown>;

/** Minimal in-memory stand-in for the two tables; every filter is honoured. */
function fakeDb(tables: { call_recordings: Row[]; call_reports: Row[] }) {
  const writes: Array<{ table: string; id: unknown; patch: Row }> = [];
  function query(table: keyof typeof tables) {
    const filters: Array<(r: Row) => boolean> = [];
    let patch: Row | null = null;
    let limit = Infinity;
    const rows = () => tables[table].filter((r) => filters.every((f) => f(r))).slice(0, limit);
    const run = () => {
      const hit = rows();
      if (patch) for (const r of hit) { Object.assign(r, patch); writes.push({ table, id: r["id"], patch }); }
      return { data: hit.map((r) => ({ ...r })), error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      update: (p: Row) => { patch = p; return q; },
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q; },
      is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return q; },
      gte: (k: string, v: string) => { filters.push((r) => String(r[k]) >= v); return q; },
      lte: (k: string, v: string) => { filters.push((r) => String(r[k]) <= v); return q; },
      limit: (n: number) => { limit = n; return q; },
      maybeSingle: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return q;
  }
  return { db: { from: query } as unknown as SupabaseClient<Database>, writes };
}

const AGENT = "agent-1";
const OTHER = "agent-2";
const PHONE = "01712345678";
const AT = "2026-11-01T10:00:00.000Z";
const iso = (offsetS: number) => new Date(Date.parse(AT) + offsetS * 1000).toISOString();

function liveRow(over: Row = {}): Row {
  return {
    id: "rec-live", agent_id: AGENT, lead_id: "lead-1", phone_number: PHONE, external_call_id: "uuid-live-1",
    call_log_id: null, started_at: iso(2), call_status: "completed", call_direction: "outgoing", answered_at: null,
    finished_at: iso(80), duration_seconds: 78, device_reported_duration_seconds: 78, call_source: "android_sim", ...over,
  };
}
const input = (over: Partial<Parameters<typeof reconcileLateCallLog>[1]> = {}) => ({
  agentId: AGENT, phone: PHONE, callUid: "log-812-5678", state: "completed" as const, durationSeconds: 41, at: AT,
  nowIso: "2026-11-01T10:05:00.000Z", ...over,
});

describe("G2: late call-log entry reconciles the live row of the same call", () => {
  it("updates the existing live row with CallLog duration and the source marker, without a second row", async () => {
    const tables = { call_recordings: [liveRow()], call_reports: [] as Row[] };
    const { db } = fakeDb(tables);
    const r = await reconcileLateCallLog(db, input());
    expect(r).toMatchObject({ recordingId: "rec-live", reconciled: true, callStatus: "completed", previous: { duration_seconds: 78 } });
    expect(tables.call_recordings).toHaveLength(1);
    expect(tables.call_recordings[0]).toMatchObject({
      duration_seconds: 41, call_status: "completed", talk_time_source: "call_log",
      talk_time_verified_at: "2026-11-01T10:05:00.000Z", call_log_id: "log-812-5678",
      device_reported_duration_seconds: 78, finished_at: iso(80),
    });
  });

  it("downgrades app 2.21 ringing time to no answer when the call log says nobody picked up", async () => {
    const tables = { call_recordings: [liveRow()], call_reports: [] as Row[] };
    await reconcileLateCallLog(fakeDb(tables).db, input({ state: "no_answer", durationSeconds: 0 }));
    expect(tables.call_recordings[0]).toMatchObject({ call_status: "no_answer", duration_seconds: 0, talk_time_source: "call_log" });
  });

  it("is idempotent: a retry of the same call-log entry writes nothing more", async () => {
    const tables = { call_recordings: [liveRow()], call_reports: [] as Row[] };
    const { db, writes } = fakeDb(tables);
    await reconcileLateCallLog(db, input());
    const again = await reconcileLateCallLog(db, input());
    expect(again).toMatchObject({ recordingId: "rec-live", reconciled: false });
    expect(writes.filter((w) => w.table === "call_recordings")).toHaveLength(1);
  });

  it("returns null (store separately) when there is no nearby live row", async () => {
    const tables = { call_recordings: [liveRow({ started_at: iso(-600) })], call_reports: [] as Row[] };
    const { db, writes } = fakeDb(tables);
    expect(await reconcileLateCallLog(db, input())).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it("never merges into one of two ambiguous nearby calls", async () => {
    const tables = {
      call_recordings: [liveRow({ id: "a", external_call_id: "u-a", started_at: iso(-90) }), liveRow({ id: "b", external_call_id: "u-b", started_at: iso(100) })],
      call_reports: [] as Row[],
    };
    const { db, writes } = fakeDb(tables);
    expect(await reconcileLateCallLog(db, input())).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it("never updates another agent's row for the same number", async () => {
    const tables = { call_recordings: [liveRow({ agent_id: OTHER })], call_reports: [] as Row[] };
    const { db, writes } = fakeDb(tables);
    expect(await reconcileLateCallLog(db, input())).toBeNull();
    expect(tables.call_recordings[0]!["duration_seconds"]).toBe(78);
    expect(writes).toHaveLength(0);
  });

  it("copies only duration fields onto a pending report and leaves submitted reports alone", async () => {
    const pending = { id: "rep-p", recording_id: "rec-live", agent_id: AGENT, status: "pending", category: null, grade: null, duration_seconds: 78, connected: true };
    const submitted = { id: "rep-s", recording_id: "rec-live", agent_id: AGENT, status: "submitted", category: "follow_up", grade: "B", duration_seconds: 78 };
    const tables = { call_recordings: [liveRow()], call_reports: [pending, submitted] as Row[] };
    await reconcileLateCallLog(fakeDb(tables).db, input());
    expect(tables.call_reports[0]).toEqual({ ...pending, duration_seconds: 41, device_reported_duration_seconds: 41, duration_source: "phone_sync", duration_synced_at: "2026-11-01T10:05:00.000Z" });
    expect(tables.call_reports[1]).toEqual(submitted);
  });
});

describe("matching rules", () => {
  const base = { agentId: AGENT, callUid: "log-1-5678", atMs: Date.parse(AT) };
  it("picks the single close call among several within the wide window", () => {
    const m = pickCallLogMatch([
      { id: "far", agent_id: AGENT, external_call_id: "x", started_at: iso(-120) },
      { id: "near", agent_id: AGENT, external_call_id: "y", started_at: iso(5) },
    ], base);
    expect(m).toMatchObject({ kind: "matched", row: { id: "near" } });
  });
  it("skips rows that are call-log rows or already reconciled by another entry", () => {
    expect(pickCallLogMatch([
      { id: "l", agent_id: AGENT, external_call_id: "log-9-5678", started_at: iso(0) },
      { id: "r", agent_id: AGENT, external_call_id: "z", call_log_id: "log-7-5678", started_at: iso(1) },
    ], base).kind).toBe("none");
  });
  it("keeps an answered incoming row completed with 0 seconds when an old app says no answer", () => {
    const p = callLogReconcilePatch({ call_direction: "incoming_callback", answered_at: AT }, { state: "no_answer", durationSeconds: 0, atMs: Date.parse(AT), callUid: "log-1" }, AT);
    expect(p).toMatchObject({ call_status: "completed", duration_seconds: 0 });
  });
});

describe("duration precedence and connected-talk-time evidence", () => {
  it("phone > web timer > entered", () => {
    expect(resolveCallDuration({ phoneSeconds: 41, storedSeconds: 78, enteredSeconds: 120 })).toBe(41);
    expect(resolveCallDuration({ phoneSeconds: 0, storedSeconds: 78, enteredSeconds: 120 })).toBe(78);
    expect(resolveCallDuration({ phoneSeconds: null, storedSeconds: 0, enteredSeconds: 120 })).toBe(120);
    expect(resolveDurationSource({ phoneSeconds: 41, storedSeconds: 78 })).toBe("phone_sync");
  });
  it("a reconciled live dialer row counts as phone-measured; an unmarked one does not", () => {
    expect(isPhoneMeasuredCall({ call_source: "android_dialer", external_call_id: "uuid", talk_time_source: "call_log" })).toBe(true);
    expect(isPhoneMeasuredCall({ call_source: "android_dialer", external_call_id: "uuid" })).toBe(false);
    expect(isPhoneMeasuredCall({ call_source: "web_callback", talk_time_source: "call_log" })).toBe(false);
  });
  it("a zero-second answered incoming call never proves connected talk time", () => {
    const base = { agent_id: AGENT, lead_id: "lead-1", external_call_id: "u", call_status: "completed", talk_time_source: "call_log" };
    const call = (row: Record<string, unknown>) => verifyLeadFromCallEvidence({ callUid: "u", agentId: AGENT, leadId: "lead-1", row: { ...base, ...row } });
    expect(call({ duration_seconds: 0, call_source: "android_incoming" })).toEqual({ verified: false, reason: "no_talk_time" });
    expect(call({ duration_seconds: 41, call_source: "android_sim" })).toEqual({ verified: true, reason: "verified" });
    // Finalization only sets connection_verified for phone_sync with seconds > 0.
    expect(resolveDurationSource({ phoneSeconds: 0, storedSeconds: 0 })).toBe("entered");
  });
});
