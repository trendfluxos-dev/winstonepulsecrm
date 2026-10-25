import { describe, expect, it } from "vitest";
import { classifyOverdue, type OverdueEvidence } from "@/lib/overdue-evidence";
import { computeAccountability } from "@/lib/accountability";

const task: OverdueEvidence = {
  id: "f", lead_id: "l", agent_id: "a", ownerId: "a", ownershipConfirmed: true,
  created_at: "2026-10-24T02:00:00Z", scheduled_at: "2026-10-24T04:00:00Z", status: "missed",
};
const asOf = "2026-10-24T05:00:00Z";
describe("overdue evidence integrity", () => {
  it.each([
    { reason: "maintenance", from: "invalid", to: "2026-10-24T04:30:00Z" },
    { reason: "maintenance", from: "2026-10-24T04:30:00Z", to: "2026-10-24T03:00:00Z" },
    { reason: " ", from: "2026-10-24T03:00:00Z", to: "2026-10-24T04:30:00Z" },
  ])("unresolved blocker evidence is excluded from employee fault (%j)", systemBlock => {
    const evidence = classifyOverdue({ ...task, systemBlock }, asOf);
    expect(evidence).toMatchObject({ classification: "needs_review", faultEligible: false });
    expect(computeAccountability({ leads: [], missedReports: 0, dueFollowUps: [{ id: task.id, handled: false, classification: evidence.classification }] }))
      .toMatchObject({ overdueFollowUps: 0, pending: 0, flagged: false });
  });
  it.each(["duplicateOf", "replacementId"] as const)("self-referential %s needs review rather than blame", key => {
    expect(classifyOverdue({ ...task, [key]: task.id }, asOf)).toMatchObject({ classification: "needs_review", faultEligible: false });
  });
  it("a valid block outside the due time does not excuse confirmed overdue work", () => {
    expect(classifyOverdue({ ...task, systemBlock: { reason: "maintenance", from: "2026-10-24T01:00:00Z", to: "2026-10-24T02:00:00Z" } }, asOf))
      .toMatchObject({ classification: "validated_overdue", faultEligible: true });
  });
});