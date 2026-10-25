import { describe, expect, it } from "vitest";
import { computeHqSmartSummary } from "@/lib/hq-smart-summary";
import type { CcLead, CcReport } from "@/lib/command-center";

const lead: CcLead = { id: "l1", status: "pending", temperature: null, outcome_category: null, source: null, created_at: "2026-10-24T18:10:00Z", assigned_agent_id: "a1", assigned_to: null };
const report: CcReport = { id: "r1", lead_id: "l1", agent_id: "a1", connected: true, recording_id: "c1", category: "closed_converted", customer_response: null, next_action: null, requirement: null, submitted_at: "2026-10-24T18:10:00Z", created_at: "2026-10-24T18:10:00Z" };
const base = { agents: [{ id: "a1", name: "Agent" }], leads: [lead], calls: [], reports: [], followUps: [], now: new Date("2026-10-25T04:08:00Z"), dailyLeadQuota: 50 };

describe("HQ evidence summary", () => {
  it("counts a submitted call without audio and uses the Dhaka date", () => {
    const s = computeHqSmartSummary({ ...base, reports: [report] });
    expect(s.connectedToday).toBe(1);
    expect(s.noEvidence).toHaveLength(0);
    expect(s.pendingCount).toBe(0);
  });
  it("deduplicates a report-linked recording", () => {
    const s = computeHqSmartSummary({ ...base, reports: [report], calls: [{ id: "c1", lead_id: "l1", agent_id: "a1", created_at: report.created_at, duration_seconds: 60 }] });
    expect(s.connectedToday).toBe(1);
  });
  it("missing evidence is not a behind verdict", () => {
    const s = computeHqSmartSummary(base);
    expect(s.noEvidence.map(a => a.id)).toEqual(["a1"]);
    expect(s.behind).toHaveLength(0);
  });
  it("saved attempts and last call exclude leads from no-evidence pending count", () => {
    expect(computeHqSmartSummary({ ...base, leads: [{ ...lead, call_attempts: 1 }] }).pendingCount).toBe(0);
    expect(computeHqSmartSummary({ ...base, leads: [{ ...lead, last_call_at: report.created_at }] }).pendingCount).toBe(0);
  });
  it("pending evidence count excludes inactive owners and completed work", () => {
    expect(computeHqSmartSummary({ ...base, leads: [lead, { ...lead, id: "l2", assigned_agent_id: "inactive" }, { ...lead, id: "l3", work_state: "completed" }] }).pendingCount).toBe(1);
  });
  it("bookings are saved signals, never generic closed status", () => {
    expect(computeHqSmartSummary({ ...base, reports: [report] }).bookingsToday).toBe(1);
    expect(computeHqSmartSummary({ ...base, leads: [{ ...lead, status: "closed" }] }).bookingsToday).toBe(0);
  });
});