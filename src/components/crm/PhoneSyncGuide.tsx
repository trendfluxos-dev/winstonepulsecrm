import { Smartphone } from "lucide-react";
import { useT } from "@/lib/i18n";

export function PhoneSyncGuide() {
  const t = useT();
  return <section className="border-t border-border pt-4">
    <h2 className="flex items-center gap-2 text-base font-semibold"><Smartphone className="size-5 text-primary" />{t({ bn: "Facebook ছাড়া ফোন সিঙ্ক", en: "Phone sync without Facebook" })}</h2>
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
      <li>{t({ bn: "অনুমোদিত Winstone Android অ্যাপ ইনস্টল করে নিজের স্টাফ অ্যাকাউন্টে সাইন ইন করুন।", en: "Install the approved Winstone Android app and sign in with your own staff account." })}</li>
      <li>{t({ bn: "ডেস্কে নিজের কলের সিম নম্বর নিশ্চিত করুন; ফোনে চাওয়া কল ও রেকর্ডিং অনুমতি দিন।", en: "Confirm your calling SIM number in Desk; grant the requested call and recording permissions on the phone." })}</li>
      <li>{t({ bn: "Android অ্যাপের ডিভাইস/সিঙ্ক অংশে অপেক্ষমাণ কাজ, ব্যর্থতার কারণ ও শেষ নিশ্চিত সিঙ্ক দেখুন। ইন্টারনেট ফিরলে অপেক্ষমাণ কাজ আবার চেষ্টা করে।", en: "Check pending work, failure reasons and last confirmed sync in the Android device/sync section. Queued work retries when the network returns." })}</li>
    </ol>
    <p className="mt-3 text-xs text-muted-foreground">{t({ bn: "Facebook token বা Page সংযোগ লাগে না। কল রিপোর্ট জমা ও অডিও আপলোড আলাদা; ফোনের রেকর্ডিং সীমাবদ্ধতা, ব্রিফিং ও অ্যাকাউন্ট যাচাই বহাল থাকে। এখানে ফোন সংযুক্ত বা সিঙ্ক সফল হয়েছে এমন দাবি করা হচ্ছে না।", en: "No Facebook token or Page connection is needed. Call-report sync and audio upload are separate; phone recording limits, briefing and account checks still apply. This guide does not claim your phone is connected or synced." })}</p>
  </section>;
}