import { describe, expect, it } from "vitest";
import { auditPerformance, operationalScore, rangeError } from "@/lib/performance-audit";
import type { AuditInput } from "@/lib/performance-audit";
const lead = { id: "l1", status: "pending", temperature: null, outcome_category: null, source: "facebook", created_at: "2026-09-01T00:00:00Z", assigned_to: "a1", assigned_agent_id: null, work_date: "2026-10-26", work_state: "completed" };
const call = { id: "c1", agent_id: "a1", lead_id: "l1", created_at: "2026-10-26T04:00:00Z", duration_seconds: 60, call_status: "completed", call_source: "android_sim", external_call_id: "uid1" };
const report = { id: "r1", agent_id: "a1", lead_id: "l1", created_at: "2026-10-26T04:00:00Z", submitted_at: "2026-10-26T05:00:00Z", category: "interested", customer_response: null, next_action: null, requirement: "P", recording_id: "c1", connected: true, connection_verified: true };
const base: AuditInput = { leads: [lead], calls: [call], reports: [report], followUps: [], agents: [{ id: "a1", name: "Agent" }], filters: { fromDay: "2026-10-26", toDay: "2026-10-26", agentId: null, source: null, project: null }, now: new Date("2026-10-27T05:00:00Z") };
describe("Operational performance count audit", () => {
  it("rejects reversed dates rather than showing zero totals", () => {
    expect(rangeError("2026-10-27", "2026-10-26")).toContain("Start date");
    expect(() => auditPerformance({ ...base, filters: { ...base.filters, fromDay: "2026-10-27" } })).toThrow("Start date");
  });
  it("rejects malformed dates and ranges that would truncate the trend", () => {
    expect(rangeError("2026-02-30", "2026-10-26")).not.toBeNull();
    expect(rangeError("2025-01-01", "2026-10-26")).toContain("400");
  });
  it("audio missing or failed never changes operational points", () => {
    const missing = auditPerformance(base);
    const failed = auditPerformance({ ...base, calls: [{ ...call, upload_status: "failed", sync_status: "failed" }] });
    expect(missing.rows[0]?.score).toBe(9);
    expect(failed.rows[0]?.score).toBe(9);
    expect(failed.diagnostics.failed).toBe(1);
    expect(missing.diagnostics.verifiedAudio).toBe(0);
  });
  it("deduplicates exact IDs, matched reports and same actor call UID", () => {
    const result = auditPerformance({ ...base, reports: [report, report], leads: [lead, lead], calls: [call, call, { ...call, id: "c2" }] });
    expect(result.totals.calls).toBe(1);
    expect(result.totals.reports).toBe(1);
    expect(result.totals.completed).toBe(1);
    expect(result.issues.some(x => x.kind === "Duplicate call identity" && x.ids.includes("c2"))).toBe(true);
  });
  it("does not merge cross-agent attribution", () => {
    const result = auditPerformance({ ...base, reports: [{ ...report, agent_id: "a2" }] });
    expect(result.totals.calls).toBe(2);
    expect(result.issues.find(x => x.kind === "Actor/lead mismatch")?.ids).toEqual(["r1"]);
  });
  it("reports connection discrepancies without inventing an answer", () => {
    expect(auditPerformance({ ...base, reports: [{ ...report, connected: false }] }).issues.find(x => x.kind === "Connection discrepancy")?.ids).toEqual(["r1"]);
  });
  it("applies agent/source/project and range to the same operational rows", () => {
    expect(auditPerformance({ ...base, filters: { ...base.filters, source: "other" } }).totals.calls).toBe(0);
    expect(auditPerformance({ ...base, filters: { ...base.filters, agentId: "a2" } }).totals.reports).toBe(0);
    expect(auditPerformance({ ...base, filters: { ...base.filters, project: "P" } }).totals.reports).toBe(1);
    expect(auditPerformance({ ...base, filters: { ...base.filters, fromDay: "2026-10-25", toDay: "2026-10-25" } }).totals.completed).toBe(0);
  });
  it("counts completion only from saved assigned work state, not any report", () => {
    const result = auditPerformance({ ...base, leads: [{ ...lead, work_state: "new" }] });
    expect(result.totals.completed).toBe(0);
    expect(result.totals.pending).toBe(1);
    expect(result.rows[0]?.percent).toBe(0);
  });
  it("unlinked report still counts while missing sync is only a reconciliation issue", () => {
    const result = auditPerformance({ ...base, calls: [] });
    expect(result.totals.calls).toBe(1);
    expect(result.totals.reports).toBe(1);
    expect(result.issues.find(x => x.kind === "Unlinked reports")?.ids).toEqual(["r1"]);
  });
  it("verified audio needs receipt metadata, not just a URL", () => {
    expect(auditPerformance({ ...base, calls: [{ ...call, sync_status: "verified", storage_path: "path" }] }).diagnostics.verifiedAudio).toBe(0);
    expect(auditPerformance({ ...base, calls: [{ ...call, sync_status: "verified", storage_path: "path", checksum: "sha", file_size_bytes: 100 }] }).diagnostics.verifiedAudio).toBe(1);
  });
  it("completed follow-ups and overdue tasks use their own saved timestamps in range", () => {
    const followUps = [{ id: "f1", agent_id: "a1", lead_id: "l1", status: "done", completed_at: "2026-10-26T04:00:00Z", scheduled_at: "2026-10-26T03:00:00Z" }, { id: "f2", agent_id: "a1", lead_id: "l1", status: "upcoming", completed_at: null, scheduled_at: "2026-10-26T05:00:00Z" }];
    const result = auditPerformance({ ...base, followUps: [...followUps, followUps[0] ?? followUps[1] ?? { id: "unused", agent_id: null, lead_id: null, status: "done", scheduled_at: null, completed_at: null }] });
    expect(result.totals.followUps).toBe(1);
    expect(result.totals.overdue).toBe(1);
  });
  it("shows unknown classification, assignment date and roster discrepancies", () => {
    const result = auditPerformance({ ...base, leads: [{ ...lead, work_date: null }], reports: [{ ...report, category: null, agent_id: "a2" }] });
    expect(result.issues.map(x => x.kind)).toEqual(expect.arrayContaining(["Unclassified reports", "Unknown assignment date", "Unknown actor", "Roster total mismatch"]));
    expect(result.rows[0]?.percent).toBeNull();
  });
  it("uses the transparent score formula with zero audio input", () => {
    expect(operationalScore({ completed: 3, reports: 4, calls: 5, connected: 2, followUps: 2 })).toBe(30);
  });
});