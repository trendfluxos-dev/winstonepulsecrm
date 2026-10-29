/**
 * Limits on paid AI replies for customers who chat without signing in.
 * Signed-in users are not limited here. Over a limit, the message is kept and
 * handed to the human support team instead.
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
