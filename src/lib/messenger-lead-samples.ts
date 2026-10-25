import type { MessengerLeadDetails } from "@/lib/messenger-lead-details";

/** Browser-only synthetic fixtures, never intake records or lookup keys. */
export function messengerLeadSample(threadId: string): MessengerLeadDetails | null {
  if (threadId === "demo-1") return { name: "নমুনা ক্রেতা ১", phone: "নমুনা — ফোন নেই", address: "নমুনা লোকেশন: ঢাকা", source: "synthetic_demo", status: "new", temperature: "warm", grade: "B", arrivedAt: "2026-10-25T03:00:00Z" };
  if (threadId === "demo-2") return { name: "নমুনা ক্রেতা ২", phone: "নমুনা — ফোন নেই", address: null, source: "synthetic_demo", status: "follow_up", temperature: null, grade: null, arrivedAt: "2026-10-24T03:00:00Z" };
  // Remaining samples exercise unlinked/empty state, never invent a customer.
  return null;
}