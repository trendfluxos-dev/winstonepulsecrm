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
