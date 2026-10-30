/** Pure rules for the GitHub access panel; no network, no secrets. */
export type RepoVisibility = "visible" | "not_found" | "error";
export type AccessVerdict = "ready" | "invite_pending" | "no_access" | "check_failed";

export function classifyAccess(visibility: RepoVisibility, pendingInvite: boolean): AccessVerdict {
  if (visibility === "visible") return "ready";
  if (visibility === "error") return "check_failed";
  return pendingInvite ? "invite_pending" : "no_access";
}

/** Which linked credential names to check, in the order the app reads them. */
export const GITHUB_KEY_NAMES = ["GITHUB_API_KEY", "GITHUB_API_KEY_1", "GITHUB_API_KEY_2", "GITHUB_API_KEY_3"] as const;

/** Repository the automatic access watch checks. */
export const WATCHED_REPOSITORY = "trendfluxos-dev/winstone-pulse-crm";

export type AccessSnapshot = { key: string; login: string | null; verdict: AccessVerdict; canPush: boolean | null };
export type AccessChange = { kind: "revoked" | "write_lost" | "account_changed" | "connection_removed" | "restored"; key: string; login: string | null; previousLogin: string | null };

/**
 * Compare two watch snapshots. A failed check is never treated as a revocation
 * (network/gateway errors must not raise false alarms); the previous state is kept.
 */
export function diffAccess(previous: AccessSnapshot[], current: AccessSnapshot[]): AccessChange[] {
  const changes: AccessChange[] = [];
  const now = new Map(current.map((c) => [c.key, c]));
  for (const before of previous) {
    const after = now.get(before.key);
    if (!after) {
      changes.push({ kind: "connection_removed", key: before.key, login: null, previousLogin: before.login });
      continue;
    }
    if (after.verdict === "check_failed") continue;
    if (before.login && after.login && before.login !== after.login) {
      changes.push({ kind: "account_changed", key: before.key, login: after.login, previousLogin: before.login });
    }
    if (before.verdict === "ready" && after.verdict !== "ready") {
      changes.push({ kind: "revoked", key: before.key, login: after.login, previousLogin: before.login });
    } else if (before.verdict !== "ready" && before.verdict !== "check_failed" && after.verdict === "ready") {
      changes.push({ kind: "restored", key: before.key, login: after.login, previousLogin: before.login });
    } else if (before.verdict === "ready" && after.verdict === "ready" && before.canPush === true && after.canPush === false) {
      changes.push({ kind: "write_lost", key: before.key, login: after.login, previousLogin: before.login });
    }
  }
  return changes;
}

/** Next snapshot: keep the last known state for any connection whose check failed. */
export function mergeSnapshot(previous: AccessSnapshot[], current: AccessSnapshot[]): AccessSnapshot[] {
  const old = new Map(previous.map((p) => [p.key, p]));
  return current.map((c) => (c.verdict === "check_failed" && old.has(c.key) ? old.get(c.key)! : c));
}
