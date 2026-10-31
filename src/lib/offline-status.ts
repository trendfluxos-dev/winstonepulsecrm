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
