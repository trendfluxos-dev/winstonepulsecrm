/**
 * Limits on paid AI replies for customers who chat without signing in.
 * Only approved, active staff skip these limits; any other account counts as
 * a guest. Over a limit, the message is kept and handed to the human team.
 */
export const GUEST_AI_REPLIES_PER_CONVERSATION = 5;
export const GUEST_AI_REPLIES_PER_DAY = 200;

export type GuestAiDecision =
  | { allow: true }
  | { allow: false; reason: "conversation_limit" | "daily_limit" };

export function decideGuestAiReply(input: {
  signedIn: boolean;
  conversationAiReplies: number;
  guestAiRepliesLast24h: number;
}): GuestAiDecision {
  if (input.signedIn) return { allow: true };
  if (input.conversationAiReplies >= GUEST_AI_REPLIES_PER_CONVERSATION) {
    return { allow: false, reason: "conversation_limit" };
  }
  if (input.guestAiRepliesLast24h >= GUEST_AI_REPLIES_PER_DAY) {
    return { allow: false, reason: "daily_limit" };
  }
  return { allow: true };
}

type StaffCheckClient = {
  auth: { getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null } | null }> };
  rpc: (
    fn: "is_active_staff",
    args: { _user_id: string },
  ) => PromiseLike<{ data: boolean | null; error: unknown }>;
};

/**
 * True only when the bearer token belongs to approved, active staff.
 * Unknown tokens, unapproved sign-ups and failed checks are treated as guests.
 */
export async function callerIsActiveStaff(
  authorizationHeader: string,
  client: StaffCheckClient,
): Promise<boolean> {
  const bearer = authorizationHeader.toLowerCase().startsWith("bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";
  if (!bearer) return false;
  try {
    const { data } = await client.auth.getUser(bearer);
    const userId = data?.user?.id;
    if (!userId) return false;
    const staff = await client.rpc("is_active_staff", { _user_id: userId });
    return !staff.error && staff.data === true;
  } catch {
    return false;
  }
}
