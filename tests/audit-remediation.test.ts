import { describe, expect, it } from "vitest";
import { audioChecksum, audioStored, assertAudioIdentity, recordingAvailability, reconcileLifecycle, lifecyclePatch, uploadConfirmed } from "@/lib/call-reconciliation";
import { accountLock, ACCESS_RECOVERY } from "@/lib/access-recovery";
import { selectAssignmentCandidates, eligibleRoster, assertPreviewUnchanged } from "@/lib/assignment-preview";
import { classifyOverdue, faultOverdueCount, type OverdueEvidence } from "@/lib/overdue-evidence";
import { computeAccountability, dhakaDate, dhakaDayBounds } from "@/lib/accountability";
import { extractBangladeshPhones } from "@/lib/lead-phone";

describe("call reconciliation evidence", () => {
  const row = { id: "r", agent_id: "a", lead_id: "l", checksum: "hash", storage_path: "audio", upload_status: "uploaded", recording_status: "stored", call_status: "completed" };
  it("maps legacy stored and current available only with stored audio evidence", () => {
    expect(recordingAvailability(row)).toBe("available");
    expect(recordingAvailability({ recording_status: "available", upload_status: "uploaded" })).toBe("unknown");
    expect(audioStored({ ...row, storage_path: null })).toBe(false);
  });
  it("replay keeps terminal lifecycle and confirmed audio", () => {
    expect(reconcileLifecycle(row, { call_status: "initiated", recording_status: "unknown" })).toEqual({ call_status: "completed", recording_status: "available" });
    expect(reconcileLifecycle(row, { call_status: "no_answer", recording_status: "not_available" }).call_status).toBe("completed");
  });
  it("stale lifecycle replay cannot erase timestamps or duration", () => {
    expect(lifecyclePatch(row, { call_status: "ringing", recording_status: "unknown", duration_seconds: 0 })).toEqual({ call_status: "completed", recording_status: "available" });
  });
  it("accepts same owned call checksum idempotently", () => {
    expect(() => assertAudioIdentity(row, "a", "l", "hash")).not.toThrow();
    expect(() => assertAudioIdentity(row, "a", "l", "hash")).not.toThrow();
  });
  it("rejects checksum collision without replacing original", () => {
    expect(() => assertAudioIdentity(row, "a", "l", "different")).toThrow("AUDIO_CHECKSUM_CONFLICT");
    expect(row.checksum).toBe("hash");
  });
  it("never leaks a reused call to another owner or lead", () => {
    expect(() => assertAudioIdentity(row, "b", "l", "hash")).toThrow("CALL_IDENTITY_CONFLICT");
    expect(() => assertAudioIdentity(row, "a", "other", "hash")).toThrow();
  });
  it("recognizes duplicate bytes and rejects changed bytes", async () => {
    const a = await audioChecksum(new TextEncoder().encode("abc"));
    expect(a).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await audioChecksum(new TextEncoder().encode("abc"))).toBe(a);
    expect(await audioChecksum(new TextEncoder().encode("abcd"))).not.toBe(a);
  });
  it("does not confirm audio merely from HTTP success or report sync", () => {
    expect(uploadConfirmed({ recording_id: "r" }, "hash")).toBe(false);
    expect(uploadConfirmed({ recording_id: "r", upload_status: "pending", checksum: "hash" }, "hash")).toBe(false);
    expect(uploadConfirmed({ recording_id: "r", upload_status: "uploaded", checksum: "other" }, "hash")).toBe(false);
    expect(uploadConfirmed({ recording_id: "r", upload_status: "uploaded", checksum: "hash" }, "hash")).toBe(true);
  });
});
describe("lock recovery preserves access integrity", () => {
  it.each([
    [false, "approved", "inactive"], [true, "pending", "pending_approval"],
    [true, "rejected", "rejected"], [true, "approved", null],
  ] as const)("active=%s approval=%s yields distinct cause", (active, approval, expected) => {
    expect(accountLock({ is_active: active, approval_status: approval })).toBe(expected);
  });
  it("recovery never grants authorization and retains the right authority", () => {
    expect(Object.values(ACCESS_RECOVERY).every(r => r.grantsAccess === false)).toBe(true);
    expect(ACCESS_RECOVERY.inactive.authority).toBe("it");
    expect(ACCESS_RECOVERY.pending_approval.authority).toBe("it");
    expect(ACCESS_RECOVERY.maintenance_locked.authority).toBe("architect");
    expect(ACCESS_RECOVERY.briefing_required.authority).toBe("agent");
    expect(ACCESS_RECOVERY.sim_conflict.authority).toBe("it");
  });
});
describe("human assignment preview", () => {
  const rows = [
    { id: "l1", name: "One", phone_number: "01805049666", created_at: "2026-10-01" },
    { id: "l2", name: "Two", phone_number: "+8801805049666", created_at: "2026-10-02" },
    { id: "l3", name: "Three", phone_number: "01711000000", created_at: "2026-10-03" },
  ];
  it("canonicalizes local/international representations", () => {
    expect(extractBangladeshPhones("01805049666")).toEqual(["8801805049666"]);
    expect(extractBangladeshPhones("+8801805049666")).toEqual(["8801805049666"]);
  });
  it("only active approved sales agents enter the roster", () => {
    expect(eligibleRoster({ role: "agent", is_active: true, approval_status: "approved" })).toBe(true);
    for (const row of [{ role: "admin", is_active: true, approval_status: "approved" }, { role: "agent", is_active: false, approval_status: "approved" }, { role: "agent", is_active: true, approval_status: "pending" }]) expect(eligibleRoster(row)).toBe(false);
  });
  it("selects unique eligible oldest-first without modifying queue or taken keys", () => {
    const taken = new Set<string>(); const original = JSON.stringify(rows);
    expect(selectAssignmentCandidates([...rows].reverse(), new Set(rows.map(r => r.id)), taken, 50).map(r => r.id)).toEqual(["l1", "l3"]);
    expect(taken.size).toBe(0); expect(JSON.stringify(rows)).toBe(original);
  });
  it("excludes existing held numbers, invalid rows and ineligible candidates", () => {
    expect(selectAssignmentCandidates(rows, new Set(["l1", "l2", "l3"]), new Set(["8801805049666"]), 50).map(r => r.id)).toEqual(["l3"]);
    expect(selectAssignmentCandidates(rows, new Set(["l3"]), new Set(), 0)).toEqual([]);
  });
  it("refuses changed preview before assignment, not silent replacement", () => {
    expect(() => assertPreviewUnchanged(["l1"], ["l1"])).not.toThrow();
    expect(() => assertPreviewUnchanged(["l1"], ["l3"])).toThrow();
    expect(() => assertPreviewUnchanged(["l1"], [])).toThrow();
  });
});
describe("overdue evidence fairness", () => {
  const asOf = "2026-10-24T17:59:59.999Z";
  const row: OverdueEvidence = { id: "f", agent_id: "a", lead_id: "l", ownerId: "a", ownershipConfirmed: true, scheduled_at: "2026-10-24T04:00:00Z", created_at: "2026-10-23T04:00:00Z", status: "upcoming" };
  it("requires confirmed ownership and valid timing for validated overdue", () => {
    expect(classifyOverdue(row, asOf)).toMatchObject({ classification: "validated_overdue", faultEligible: true });
  });
  it.each([
    [{ systemBlock: { reason: "briefing_required", from: "2026-10-24T03:00:00Z", to: "2026-10-24T05:00:00Z" } }, "system_blocked"],
    [{ replacementId: "child" }, "rescheduled"], [{ duplicateOf: "original" }, "duplicate"],
    [{ ownerId: "other" }, "ownership_uncertain"], [{ ownershipConfirmed: false }, "ownership_uncertain"],
    [{ scheduled_at: "invalid" }, "needs_review"], [{ created_at: "2026-10-24T06:00:00Z" }, "needs_review"],
    [{ status: "done", completed_at: "2026-10-24T02:00:00Z" }, "needs_review"],
  ] as const)("classifies evidence without employee fault: %j", (patch, classification) => {
    expect(classifyOverdue({ ...row, ...patch }, asOf)).toMatchObject({ classification, faultEligible: false });
  });
  it("unproven block does not fabricate a system excuse", () => {
    expect(classifyOverdue({ ...row, systemBlock: { reason: "offline", from: "bad", to: "bad" } }, asOf).classification).toBe("validated_overdue");
  });
  it("excludes unresolved and blocked follow-ups from employee fault KPI", () => {
    const assessments = [classifyOverdue(row, asOf), classifyOverdue({ ...row, ownershipConfirmed: false }, asOf)];
    expect(faultOverdueCount(assessments)).toBe(1);
    const m = computeAccountability({ leads: [{ id: "l", completed: true }], dueFollowUps: [
      { id: "f1", handled: false, classification: "system_blocked" },
      { id: "f2", handled: false, classification: "needs_review" },
      { id: "f3", handled: false, classification: "ownership_uncertain" },
    ], missedReports: 0 });
    expect(m).toMatchObject({ eligible: 1, overdueFollowUps: 0, pending: 0, flagged: false });
  });
  it("does not rewrite supplied historical records", () => {
    const frozen = Object.freeze({ ...row }); classifyOverdue(frozen, asOf);
    expect(frozen.status).toBe("upcoming");
  });
});
describe("explicit Dhaka reporting day", () => {
  it("midnight is 18:00 UTC, not the server UTC date", () => {
    expect(dhakaDate(0, Date.parse("2026-10-24T17:59:59Z"))).toBe("2026-10-24");
    expect(dhakaDate(0, Date.parse("2026-10-24T18:00:00Z"))).toBe("2026-10-25");
    expect(dhakaDayBounds("2026-10-25")).toEqual({ start: "2026-10-24T18:00:00.000Z", end: "2026-10-25T17:59:59.999Z" });
  });
});