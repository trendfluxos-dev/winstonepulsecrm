import { describe, expect, it } from "vitest";
import { decideGuestAiReply } from "@/lib/support-ai-budget";

describe("guest support AI budget", () => {
  it("allows a guest's 5th reply but not the 6th in one conversation", () => {
    expect(decideGuestAiReply({ signedIn: false, conversationAiReplies: 4, guestAiRepliesLast24h: 0 }).allow).toBe(true);
    expect(decideGuestAiReply({ signedIn: false, conversationAiReplies: 5, guestAiRepliesLast24h: 0 })).toEqual({
      allow: false,
      reason: "conversation_limit",
    });
  });

  it("stops guest replies once 200 AI replies happened in 24 hours", () => {
    expect(decideGuestAiReply({ signedIn: false, conversationAiReplies: 0, guestAiRepliesLast24h: 200 })).toEqual({
      allow: false,
      reason: "daily_limit",
    });
  });

  it("does not limit signed-in users", () => {
    expect(decideGuestAiReply({ signedIn: true, conversationAiReplies: 50, guestAiRepliesLast24h: 999 }).allow).toBe(true);
  });
});
