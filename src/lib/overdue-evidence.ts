/** Derived review evidence, never persisted over historical follow-up records. */
export type OverdueClass = "validated_overdue" | "system_blocked" | "rescheduled" | "duplicate" | "ownership_uncertain" | "needs_review";
export type OverdueEvidence = {
  id: string; agent_id?: string | null; lead_id?: string | null;
  scheduled_at: string | null; created_at?: string | null;
  status: string; completed_at?: string | null;
  ownerId?: string | null; ownershipConfirmed?: boolean;
  replacementId?: string | null; duplicateOf?: string | null;
  systemBlock?: { reason: string; from: string; to: string } | null;
};
export function classifyOverdue(row: OverdueEvidence, asOf: string): { classification: OverdueClass; faultEligible: boolean; reason: string } {
  const result = (classification: OverdueClass, reason: string) => ({ classification, faultEligible: classification === "validated_overdue", reason });
  const due = Date.parse(row.scheduled_at ?? ""); const at = Date.parse(asOf);
  if (!Number.isFinite(due) || !Number.isFinite(at) || due >= at) return result("needs_review", "INVALID_OR_NOT_OVERDUE_TIME");
  if (row.duplicateOf === row.id || row.replacementId === row.id) return result("needs_review", "SELF_REFERENTIAL_HISTORY_LINK");
  if (row.duplicateOf && row.duplicateOf !== row.id) return result("duplicate", "LINKED_DUPLICATE");
  if (row.replacementId && row.replacementId !== row.id) return result("rescheduled", "LINKED_REPLACEMENT");
  if (!row.lead_id || !row.agent_id || row.ownerId !== row.agent_id || !row.ownershipConfirmed) return result("ownership_uncertain", "RESPONSIBILITY_WINDOW_UNCONFIRMED");
  const created = Date.parse(row.created_at ?? "");
  if (!Number.isFinite(created) || created > due) return result("needs_review", "TASK_CREATED_AFTER_DUE_OR_UNKNOWN");
  if (row.systemBlock) {
    const from = Date.parse(row.systemBlock.from); const to = Date.parse(row.systemBlock.to);
    if (!row.systemBlock.reason.trim() || !Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      return result("needs_review", "INVALID_SYSTEM_BLOCK_EVIDENCE");
    }
    if (from <= due && to >= due) return result("system_blocked", row.systemBlock.reason);
  }
  if (!["upcoming", "missed"].includes(row.status) || row.completed_at) return result("needs_review", "OUTCOME_REQUIRES_REVIEW");
  return result("validated_overdue", "DUE_UNHANDLED_WITH_CONFIRMED_RESPONSIBILITY");
}
export function faultOverdueCount(rows: Array<ReturnType<typeof classifyOverdue>>) {
  return rows.filter(row => row.faultEligible).length;
}