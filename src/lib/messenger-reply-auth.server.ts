/**
 * Server-side authorization for one Messenger reply. Deny by default: the
 * caller must be a signed-in, writable agent/coordinator account, the thread
 * must exist, be assigned to that exact profile, be linked to a lead, and the
 * lead's canonical owner (both owner columns, conflicts fail closed) must be
 * the same profile. A client-supplied lead ID must match the thread's stored
 * lead. Every refusal returns one generic code so nothing about other
 * customers' conversations leaks.
 */
import { leadOwnerId, type LeadOwnerRow } from "@/lib/lead-access.server";

export type ReplyActor = {
  scope: "authority" | "coordinator" | "agent" | "none";
  readOnly: boolean;
  userId: string | null;
  profileId: string | null;
};

export type ReplyTargetRow = {
  id: string;
  psid: string | null;
  leadId: string | null;
  assignedAgentId: string | null;
  lead: LeadOwnerRow | null;
};

export type ReplyAuthResult =
  | { ok: true; threadId: string; leadId: string; psid: string }
  | { ok: false; code: "UNAUTHENTICATED" | "FORBIDDEN" | "THREAD_NOT_FOUND" };

const REPLY_SCOPES = new Set(["agent", "coordinator"]);

/** Role check only — runs before any database read. */
export function replyActorBlock(actor: ReplyActor): "UNAUTHENTICATED" | "FORBIDDEN" | null {
  if (!actor.userId || !actor.profileId) return "UNAUTHENTICATED";
  if (!REPLY_SCOPES.has(actor.scope) || actor.readOnly) return "FORBIDDEN";
  return null;
}

export function authorizeReplyTarget(
  actor: ReplyActor,
  row: ReplyTargetRow | null,
  claimed: { threadId: string; leadId?: string | null },
): ReplyAuthResult {
  const block = replyActorBlock(actor);
  if (block) return { ok: false, code: block };
  // Missing, mismatched or foreign threads all look the same to the caller.
  if (!row || row.id !== claimed.threadId) return { ok: false, code: "THREAD_NOT_FOUND" };
  if (!row.psid || !row.leadId || !row.lead) return { ok: false, code: "THREAD_NOT_FOUND" };
  if (claimed.leadId != null && claimed.leadId !== row.leadId)
    return { ok: false, code: "THREAD_NOT_FOUND" };
  if (row.assignedAgentId !== actor.profileId) return { ok: false, code: "THREAD_NOT_FOUND" };
  if (leadOwnerId(row.lead) !== actor.profileId) return { ok: false, code: "THREAD_NOT_FOUND" };
  return { ok: true, threadId: row.id, leadId: row.leadId, psid: row.psid };
}
