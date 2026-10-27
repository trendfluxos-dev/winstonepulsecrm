import { describe, expect, it } from "vitest";
import { callKpis, dailyCompletion, followUpKpis, inDhakaRange, leadKpis, rangeError, reportKpis, whatsappKpi } from "@/lib/kpi-contract";
import { deskLeadCounts, deskReportCounts, deskFollowUpCounts } from "@/lib/desk-counts";

const L = (id: string, owner: string, o: Record<string, unknown> = {}) => ({ id, status: "pending", work_state: "pending", work_date: null, temperature: null, assigned_agent_id: owner, assigned_to: owner, ...o });
const leads = [
  L("1", "A", { temperature: "hot" }),
  L("2", "A", { work_state: "completed", status: "closed", temperature: "hot", work_date: "2026-10-28" }),
  L("3", "A", { work_date: "2026-10-28" }),
  L("4", "A", { work_state: "duplicate_skipped" }),
  L("5", "B", { temperature: "hot" }),
  L("1", "A", { temperature: "hot" }), // duplicate id
];

describe("lead KPIs", () => {
  it("separates owned, active, historical completed and closed, per agent", () => {
    expect(leadKpis(leads, "A")).toEqual({ owned: 4, active: 2, activePending: 2, completedOwned: 1, closed: 1, hot: 1 });
    expect(leadKpis(leads, "B")).toMatchObject({ owned: 1, active: 1, hot: 1 });
  });
  it("hot counts only active leads (a completed hot lead is not hot work)", () => {
    expect(leadKpis(leads, "A").hot).toBe(1);
  });
  it("My Desk wrapper returns the same numbers as the contract", () => {
    const d = deskLeadCounts(leads, "A", { from: "2026-10-28", to: "2026-10-28" });
    expect([d.allTimeOwned, d.active, d.hot, d.rangeAssigned, d.rangeCompleted]).toEqual([4, 2, 1, 2, 1]);
  });
});

describe("daily completion", () => {
  it("uses dated assigned work as the denominator", () => {
    expect(dailyCompletion(leads, "A", "2026-10-28", 2)).toEqual({ state: "ok", assigned: 2, completed: 1, pct: 50 });
  });
  it("flags reconciliation when the ledger disagrees", () => {
    expect(dailyCompletion(leads, "A", "2026-10-28", 3)).toEqual({ state: "reconcile", assigned: 2, completed: 1, ledger: 3 });
  });
  it("another agent's dated work never enters the denominator", () => {
    expect(dailyCompletion(leads, "B", "2026-10-28", null)).toEqual({ state: "ok", assigned: 0, completed: 0, pct: 0 });
  });
});

describe("Dhaka day boundaries and ranges", () => {
  it("17:59 UTC is still the same Dhaka day, 18:00 UTC is the next", () => {
    expect(inDhakaRange("2026-10-27T17:59:00Z", { from: "2026-10-27", to: "2026-10-27" })).toBe(true);
    expect(inDhakaRange("2026-10-27T18:00:00Z", { from: "2026-10-28", to: "2026-10-28" })).toBe(true);
  });
  it("rejects reversed ranges", () => {
    expect(rangeError({ from: "2026-10-28", to: "2026-10-01" })).toMatch(/Start date/);
    expect(rangeError({ from: "2026-10-01", to: "2026-10-28" })).toBeNull();
  });
});

describe("calls vs reports", () => {
  const range = { from: "2026-10-28", to: "2026-10-28" };
  it("reports: submitted in range, deduped, connected = flag true", () => {
    const r = [{ id: "r1", submitted_at: "2026-10-28T04:00:00Z", connected: true }, { id: "r1", submitted_at: "2026-10-28T04:00:00Z", connected: true }, { id: "r2", submitted_at: "2026-10-28T05:00:00Z", connected: false }, { id: "r3", submitted_at: null, connected: true }];
    expect(reportKpis(r, range)).toEqual({ submitted: 2, reportedConnected: 1, rate: 50 });
    expect(deskReportCounts(r, "2026-10-28")).toEqual({ submitted: 2, reportedConnected: 1 });
  });
  it("phone calls: connected means more than 10 seconds", () => {
    const c = [{ id: "c1", created_at: "2026-10-28T04:00:00Z", duration_seconds: 10 }, { id: "c2", created_at: "2026-10-28T04:00:00Z", duration_seconds: 11 }];
    expect(callKpis(c, range)).toEqual({ attempts: 2, connected: 1, rate: 50 });
  });
});

describe("follow-ups and WhatsApp", () => {
  it("open/overdue from one deduped source", () => {
    const now = new Date("2026-10-28T06:00:00Z");
    const f = [{ id: "f1", status: "upcoming", scheduled_at: "2026-10-27T06:00:00Z" }, { id: "f1", status: "upcoming", scheduled_at: "2026-10-27T06:00:00Z" }, { id: "f2", status: "rescheduled", scheduled_at: "2026-10-28T10:00:00Z" }, { id: "f3", status: "done", scheduled_at: "2026-10-27T06:00:00Z" }];
    expect(followUpKpis(f, now)).toEqual({ open: 2, overdue: 1, dueToday: 1 });
    expect(deskFollowUpCounts(f, now)).toEqual(followUpKpis(f, now));
  });
  it("WhatsApp is unavailable without any synced evidence, never 0", () => {
    expect(whatsappKpi([], { from: null, to: null })).toBeNull();
    expect(whatsappKpi([{ id: "m", created_at: "2026-10-28T04:00:00Z" }], { from: "2026-10-28", to: "2026-10-28" })).toBe(1);
  });
});

describe("regression: agent Analytics lead tiles showed 0 while reports loaded", () => {
  // Shape returned by readAgentLeads (select *): both owner columns present, sometimes only one set.
  const snapshot = [
    { id: "a", status: "closed", work_state: "completed", temperature: "hot", work_date: "2026-10-20", assigned_agent_id: "11111111-1111-4111-8111-111111111111", assigned_to: "11111111-1111-4111-8111-111111111111", updated_at: "x" },
    { id: "b", status: "pending", work_state: "pending", temperature: "hot", work_date: null, assigned_agent_id: null, assigned_to: "11111111-1111-4111-8111-111111111111", updated_at: "x" },
    { id: "c", status: "pending", work_state: "pending", temperature: null, work_date: null, assigned_agent_id: "22222222-2222-4222-8222-222222222222", assigned_to: "22222222-2222-4222-8222-222222222222", updated_at: "x" },
  ];
  it("an empty browser identity yields zeros — which is why tiles now wait for the server agent id", () => {
    expect(leadKpis(snapshot, "").owned).toBe(0);
  });
  it("the server session id counts its own rows and isolates the other agent", () => {
    expect(leadKpis(snapshot, "11111111-1111-4111-8111-111111111111")).toEqual({ owned: 2, active: 1, activePending: 1, completedOwned: 1, closed: 1, hot: 1 });
    expect(leadKpis(snapshot, "22222222-2222-4222-8222-222222222222")).toMatchObject({ owned: 1, active: 1, hot: 0, closed: 0 });
  });
});

import { reportLeadReconciliation } from "@/lib/kpi-contract";
describe("reports vs leads reconciliation", () => {
  const reps = [
    { id: "r1", submitted_at: "2026-10-20T04:00:00Z", connected: true, lead_id: "L1" },
    { id: "r2", submitted_at: "2026-10-21T04:00:00Z", connected: false, lead_id: "L1" },
    { id: "r2", submitted_at: "2026-10-21T04:00:00Z", connected: false, lead_id: "L1" },
    { id: "r3", submitted_at: "2026-10-22T04:00:00Z", connected: true, lead_id: "L2" },
    { id: "r4", submitted_at: "2026-09-01T04:00:00Z", connected: true, lead_id: "L3" },
  ];
  it("counts many reports per lead and splits still-owned vs moved", () => {
    const r = reportLeadReconciliation(reps, { from: null, to: null }, new Set(["L1"]));
    expect(r).toMatchObject({ reports: 4, leads: 3, stillOwned: 1, movedAway: 2, maxPerLead: 2, multiReportLeads: 1, withoutLead: 0 });
  });
  it("respects the selected Dhaka range", () => {
    const r = reportLeadReconciliation(reps, { from: "2026-10-01", to: "2026-10-31" }, new Set());
    expect(r.reports).toBe(3);
    expect(r.leads).toBe(2);
  });
});
