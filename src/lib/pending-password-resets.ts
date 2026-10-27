export type ResetKind = "link" | "it_password";

export type ResetAuditRow = {
  entity_id: string | null;
  action: string;
  created_at: string;
  metadata: unknown;
};

/** Latest reset per profile: an emailed link, or IT setting a temporary password. */
export function latestResets(rows: ResetAuditRow[]): Map<string, { at: string; kind: ResetKind }> {
  const out = new Map<string, { at: string; kind: ResetKind }>();
  for (const r of rows) {
    if (!r.entity_id) continue;
    let kind: ResetKind | null = null;
    if (r.action === "agent_password_reset_link_issued") kind = "link";
    else if (
      r.action === "agent_account_updated" &&
      (r.metadata as { passwordChanged?: unknown } | null)?.passwordChanged === true
    )
      kind = "it_password";
    if (!kind) continue;
    const prev = out.get(r.entity_id);
    if (!prev || r.created_at > prev.at) out.set(r.entity_id, { at: r.created_at, kind });
  }
  return out;
}

export type PendingResetInput = {
  profileId: string;
  hasAccount: boolean;
  mustChangePassword: boolean;
  resetIssuedAt: string | null;
};

/** Accounts still required to set a new password, oldest reset first (unknown time last). */
export function pendingResets<T extends PendingResetInput>(rows: T[]): T[] {
  return rows
    .filter((r) => r.hasAccount && r.mustChangePassword)
    .sort((a, b) => {
      if (!a.resetIssuedAt) return b.resetIssuedAt ? 1 : 0;
      if (!b.resetIssuedAt) return -1;
      return a.resetIssuedAt.localeCompare(b.resetIssuedAt);
    });
}

/** Whole days waiting since the reset was issued. */
export function daysWaiting(issuedAt: string | null, now: Date): number | null {
  if (!issuedAt) return null;
  const ms = now.getTime() - new Date(issuedAt).getTime();
  return ms < 0 ? 0 : Math.floor(ms / 86_400_000);
}
