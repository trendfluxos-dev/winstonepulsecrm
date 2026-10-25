import { messengerPreparation } from "@/lib/messenger-readiness";

/** Preparation only: no secret inspection, provider requests or invented metrics. */
export function integrationPreparation() {
  const messenger = messengerPreparation();
  const windsor = { connected: false as const, contract: "unverified" as const, configuration: "not_checked" as const };
  const verification = {
    messenger: { checkedAt: null, outcome: "not_checked" as const, reason: { bn: "App/Page অনুমোদন ও subscription যাচাই বাকি; signed POST পরীক্ষা প্রস্তুত, কিন্তু বার্তা সংরক্ষণ চালু নয়।", en: "App/Page approvals and subscription unverified; signed POST validation is prepared but message storage is not enabled." } },
    windsor: { checkedAt: null, outcome: "not_checked" as const, reason: { bn: "অফিশিয়াল API ও অ্যাকাউন্টের অনুমতি যাচাই বাকি; সরাসরি পরীক্ষা হয়নি।", en: "Official API and account permission unverified; no live check performed." } },
  };
  return { messenger, windsor, verification, noneConnected: !messenger.connected && !windsor.connected };
}