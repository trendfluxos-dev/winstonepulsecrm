import { describe, expect, it } from "vitest";
import { deskFollowUpCounts, deskLeadCounts, deskReportCounts, isHotActive } from "@/lib/desk-counts";

const me = "a1";
const L = (id: string, o: Record<string, unknown> = {}) => ({ id, status: "pending", work_state: "pending", work_date: "2026-10-28", temperature: null, assigned_agent_id: me, assigned_to: me, ...o });

describe("desk counts", () => {
  it("active leads exclude completed, duplicate_skipped and other agents", () => {
    const c = deskLeadCounts([L("1"), L("2", { work_state: "completed" }), L("3", { work_state: "duplicate_skipped" }), L("4", { assigned_agent_id: "x", assigned_to: "x" })], me, { from: "2026-10-28", to: "2026-10-28" });
    expect(c.active).toBe(1);
    expect(c.allTimeOwned).toBe(3);
  });
  it("completed counts only my leads inside the work_date window", () => {
    const c = deskLeadCounts([L("1", { work_state: "completed" }), L("2", { work_state: "completed", work_date: "2026-10-01" }), L("3", { work_state: "completed", assigned_agent_id: "x" })], me, { from: "2026-10-28", to: "2026-10-28" });
    expect(c.rangeCompleted).toBe(1);
    expect(c.rangeAssigned).toBe(1);
  });
  it("reports count by Dhaka submitted day, duplicates once", () => {
    const r = { id: "r", submitted_at: "2026-10-27T20:00:00Z", connected: true };
    expect(deskReportCounts([r, r, { id: "s", submitted_at: "2026-10-27T17:00:00Z", connected: true }], "2026-10-28")).toEqual({ submitted: 1, reportedConnected: 1 });
  });
  it("overdue = open items scheduled before now; done excluded", () => {
    const now = new Date("2026-10-28T06:00:00Z");
    const c = deskFollowUpCounts([{ id: "1", status: "upcoming", scheduled_at: "2026-10-27T00:00:00Z" }, { id: "2", status: "rescheduled", scheduled_at: "2026-10-26T00:00:00Z" }, { id: "3", status: "done", scheduled_at: "2026-10-20T00:00:00Z" }, { id: "4", status: "upcoming", scheduled_at: "2026-10-28T10:00:00Z" }], now);
    expect(c).toEqual({ open: 3, overdue: 2, dueToday: 1 });
  });
  it("hot uses one rule: temperature hot on an active assigned lead", () => {
    expect(isHotActive(L("1", { temperature: "hot" }), me)).toBe(true);
    expect(isHotActive(L("2", { temperature: "hot", work_state: "completed" }), me)).toBe(false);
    expect(deskLeadCounts([L("1", { temperature: "hot" }), L("2", { temperature: "hot", work_state: "completed" })], me, { from: "2026-10-28", to: "2026-10-28" }).hot).toBe(1);
  });
});

import { deskRangeError } from "@/lib/desk-range";
describe("desk date range", () => {
  it("reversed range is an error, valid range is not", () => {
    expect(deskRangeError("2026-10-28", "2026-10-01")).toBe("Start date must be on or before end date.");
    expect(deskRangeError("2026-10-01", "2026-10-28")).toBeNull();
  });
});
