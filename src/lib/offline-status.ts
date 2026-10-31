import type { OfflineItem, SentItem } from "@/lib/offline-queue";

type Bi = { bn: string; en: string };

/** One honest label per state: nothing reads as "sent" until the server answered. */
export function offlineStatusLabel(item: Pick<OfflineItem, "status"> | Pick<SentItem, "outcome">): {
  title: Bi;
  hint: Bi;
} {
  if ("outcome" in item) {
    if (item.outcome === "not_accepted")
      return {
        title: { bn: "গৃহীত হয়নি", en: "Not accepted" },
        hint: {
          bn: "সার্ভার এটি নেয়নি — রিপোর্ট আবার দেখুন বা IT-কে জানান",
          en: "The server refused it — check the report or tell IT",
        },
      };
    if (item.outcome === "already_on_server")
      return {
        title: { bn: "পাঠানো হয়েছে", en: "Sent" },
        hint: { bn: "সার্ভারে আগেই ছিল", en: "Already on the server" },
      };
    return {
      title: { bn: "পাঠানো হয়েছে", en: "Sent" },
      hint: { bn: "সার্ভার নিশ্চিত করেছে", en: "Confirmed by the server" },
    };
  }
  if (item.status === "syncing")
    return {
      title: { bn: "পাঠানো হচ্ছে", en: "Syncing" },
      hint: { bn: "এখন সার্ভারে যাচ্ছে", en: "Sending to the server now" },
    };
  if (item.status === "failed")
    return {
      title: { bn: "পাঠানো যায়নি", en: "Not sent yet" },
      hint: {
        bn: "এই ফোনে সেভ আছে — আবার চেষ্টা করুন",
        en: "Still saved on this phone — try again",
      },
    };
  return {
    title: { bn: "অপেক্ষমাণ", en: "Pending" },
    hint: { bn: "এই ফোনে সেভ আছে — নেট ফিরলে যাবে", en: "Saved on this phone — sends when online" },
  };
}

export type OfflineTimelineStep = { key: "queued" | "last_attempt" | "confirmed" | "refused"; label: Bi; at: string | null };

/**
 * Per-report details: when it was saved on this phone, when it was last sent,
 * and when the server answered. "Confirmed" is only ever the server's answer;
 * a refused report shows a refusal time instead, and a queued one shows none.
 */
export function offlineTimeline(item: OfflineItem | SentItem): { steps: OfflineTimelineStep[]; attempts: number } {
  const queued: OfflineTimelineStep = { key: "queued", label: { bn: "এই ফোনে জমা", en: "Queued on this phone" }, at: item.createdAt };
  const last: OfflineTimelineStep = { key: "last_attempt", label: { bn: "শেষ পাঠানোর চেষ্টা", en: "Last attempt" }, at: item.lastAttemptAt ?? null };
  if ("outcome" in item) {
    const answer: OfflineTimelineStep =
      item.outcome === "not_accepted"
        ? { key: "refused", label: { bn: "সার্ভার নেয়নি", en: "Refused by server" }, at: item.sentAt }
        : { key: "confirmed", label: { bn: "সার্ভার নিশ্চিত করেছে", en: "Confirmed by server" }, at: item.sentAt };
    return { steps: [queued, { ...last, at: last.at ?? item.sentAt }, answer], attempts: item.attempts ?? 1 };
  }
  return {
    steps: [queued, last, { key: "confirmed", label: { bn: "সার্ভার নিশ্চিত করেছে", en: "Confirmed by server" }, at: null }],
    attempts: item.attempts + (item.status === "syncing" ? 1 : 0),
  };
}


export type StuckReason = "syncing_too_long" | "not_sent" | "refused";

/**
 * Offline call reports that need the agent's attention. Only report_submit
 * items count; a refusal from the server is always an alert.
 */
export function stuckReports(
  queue: readonly OfflineItem[],
  sent: readonly SentItem[],
  now = Date.now(),
  limits: { syncingMinutes: number; notSentMinutes: number } = { syncingMinutes: 2, notSentMinutes: 15 },
): { id: string; label: string; reason: StuckReason; since: string }[] {
  const out: { id: string; label: string; reason: StuckReason; since: string }[] = [];
  for (const item of queue) {
    if (item.kind !== "report_submit") continue;
    if (item.status === "syncing" && item.lastAttemptAt && now - Date.parse(item.lastAttemptAt) >= limits.syncingMinutes * 60_000) {
      out.push({ id: item.id, label: item.label, reason: "syncing_too_long", since: item.lastAttemptAt });
    } else if (now - Date.parse(item.createdAt) >= limits.notSentMinutes * 60_000) {
      out.push({ id: item.id, label: item.label, reason: "not_sent", since: item.createdAt });
    }
  }
  for (const s of sent) {
    if (s.kind === "report_submit" && s.outcome === "not_accepted") {
      out.push({ id: s.id, label: s.label, reason: "refused", since: s.sentAt });
    }
  }
  return out;
}

export const STUCK_REASON_LABEL: Record<StuckReason, Bi> = {
  syncing_too_long: { bn: "অনেকক্ষণ ধরে পাঠানো হচ্ছে — সংযোগ দেখুন", en: "Stuck in Syncing — check the connection" },
  not_sent: { bn: "নির্ধারিত সময়েও সার্ভারে পৌঁছায়নি", en: "Not sent within the set time" },
  refused: { bn: "সার্ভার নেয়নি — রিপোর্ট আবার দেখুন বা IT-কে জানান", en: "Refused by the server — check it or tell IT" },
};
