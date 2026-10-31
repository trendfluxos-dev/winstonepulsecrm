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

import { callerIsActiveStaff } from "@/lib/support-ai-budget";

function fakeClient(user: { id: string } | null, staff: boolean | null, error: unknown = null) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: async () => ({ data: staff, error }),
  };
}

describe("who skips the guest AI limits", () => {
  it("treats a visitor without a sign-in as a guest", async () => {
    expect(await callerIsActiveStaff("", fakeClient({ id: "u1" }, true))).toBe(false);
  });

  it("treats a signed-in account that is not approved staff as a guest", async () => {
    expect(await callerIsActiveStaff("Bearer abc", fakeClient({ id: "u1" }, false))).toBe(false);
  });

  it("treats a failed staff check as a guest", async () => {
    expect(await callerIsActiveStaff("Bearer abc", fakeClient({ id: "u1" }, true, new Error("x")))).toBe(false);
  });

  it("lets approved, active staff skip the guest limits", async () => {
    expect(await callerIsActiveStaff("Bearer abc", fakeClient({ id: "u1" }, true))).toBe(true);
  });
});
