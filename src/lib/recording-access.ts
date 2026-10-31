/**
 * Who may hear any stored call recording regardless of current lead ownership.
 *
 * Only a genuine HQ/IT PIN session (no profile attached) or an admin account.
 * Signed-in staff — including agents who also hold Executive HQ viewing access
 * and team leaders — hear only recordings on leads they own right now, so a
 * lead moving to another agent removes access immediately.
 */
export function hasFullRecordingAccess(caller: {
  scope: string;
  profile: { role: string } | null;
}): boolean {
  if (caller.scope !== "authority") return false;
  return caller.profile === null || caller.profile.role === "admin";
}
