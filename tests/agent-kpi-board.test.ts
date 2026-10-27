import { describe, expect, it } from "vitest";
import { agentKpiRows } from "@/lib/agent-kpi-board";

describe("HQ per-agent KPI contract", () => {
  it("isolates current ownership and historical report authors, and counts unique reports/leads", () => {
    const rows = agentKpiRows([{ id: "a", name: "A" }, { id: "b", name: "B" }], [
      { id: "l1", assigned_agent_id: "a", status: "closed", work_state: "completed" },
      { id: "l2", assigned_agent_id: "b", assigned_to: "a", status: "pending", work_state: "pending", temperature: "hot" },
    ], [
      { id: "r1", lead_id: "l1", agent_id: "a", submitted_at: "2026-10-27T19:00:00Z", connected: true },
      { id: "r2", lead_id: "l1", agent_id: "a", submitted_at: "2026-10-27T20:00:00Z", connected: false },
      { id: "r2", lead_id: "l1", agent_id: "a", submitted_at: "2026-10-27T20:00:00Z", connected: false },
      { id: "r3", lead_id: "l2", agent_id: "b", submitted_at: "2026-10-27T17:59:00Z", connected: true },
    ], [{ id: "f", agent_id: "b", status: "upcoming", scheduled_at: "2026-10-27T20:00:00Z" }], { from: "2026-10-28", to: "2026-10-28" }, new Date("2026-10-28T00:00:00Z"));
    expect(rows[0]).toMatchObject({ leads: { owned: 1, active: 0, closed: 1, hot: 0 }, reports: { submitted: 2, reportedConnected: 1 }, breakdown: { leads: 1, multiReportLeads: 1 }, followUps: { open: 0 } });
    expect(rows[1]).toMatchObject({ leads: { owned: 1, active: 1, closed: 0, hot: 1 }, reports: { submitted: 0 }, followUps: { open: 1, overdue: 1 } });
  });
});