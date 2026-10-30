import { Smartphone } from "lucide-react";

import { useT } from "@/lib/i18n";

/** Short agent-facing guide for getting the Android test APK onto a real phone.
 * Steps only — no invented download URLs. The link always comes from IT/HQ. */
export function AndroidApkInstallGuide() {
  const t = useT();
  const steps: { title: string; body: string }[] = [
    {
      title: t({ en: "1. Get the link from IT", bn: "১. IT থেকে লিংক নিন" }),
      body: t({
        en: "Ask HQ/IT for the APK download link of the latest test build. Install only from that link — never from a random website or forwarded file.",
        bn: "সর্বশেষ টেস্ট বিল্ডের APK ডাউনলোড লিংক HQ/IT থেকে নিন। শুধু সেই লিংক থেকেই ইনস্টল করুন — অন্য কোনো ওয়েবসাইট বা ফরওয়ার্ড করা ফাইল থেকে নয়।",
      }),
    },
    {
      title: t({ en: "2. Download on your phone", bn: "২. ফোনে ডাউনলোড করুন" }),
      body: t({
        en: "Open the link on the phone you use for calls and download the APK file. It is a test build, so it may not install over a Winstone Pulse app you already have — remove the old one first if the install is refused.",
        bn: "যে ফোনে কল করেন সেই ফোনেই লিংক খুলে APK ফাইলটি ডাউনলোড করুন। এটি টেস্ট বিল্ড, তাই আগে থেকে থাকা Winstone Pulse অ্যাপের ওপর ইনস্টল নাও হতে পারে — সেক্ষেত্রে পুরোনো অ্যাপটি আগে তুলে ফেলুন।",
      }),
    },
    {
      title: t({ en: "3. Allow unknown apps", bn: "৩. অজানা অ্যাপ অনুমতি দিন" }),
      body: t({
        en: "When Android asks, tap Settings → allow \"Install unknown apps\" for the browser you downloaded with, then go back and tap Install.",
        bn: "অ্যান্ড্রয়েড জিজ্ঞেস করলে Settings → যে ব্রাউজার দিয়ে ডাউনলোড করেছেন তার জন্য \"Install unknown apps\" অনুমতি দিন, তারপর ফিরে এসে Install চাপুন।",
      }),
    },
    {
      title: t({ en: "4. Sign in and grant permissions", bn: "৪. সাইন ইন ও অনুমতি" }),
      body: t({
        en: "Open the app, sign in with your CRM account, and allow Phone, Call logs, Microphone and Notifications when asked (Settings → Apps → Winstone Pulse → Permissions).",
        bn: "অ্যাপ খুলে আপনার CRM অ্যাকাউন্টে সাইন ইন করুন এবং বললে Phone, Call logs, Microphone ও Notifications অনুমতি দিন (Settings → Apps → Winstone Pulse → Permissions)।",
      }),
    },
    {
      title: t({ en: "5. Make one test call", bn: "৫. একটি টেস্ট কল করুন" }),
      body: t({
        en: "Call a test number — never a customer. Check: the call shows in the CRM, the recording plays after 2–3 minutes, and a summary appears. Also try one short rejection report (Not Interested / Wrong Number / Fake) and confirm it asks only the short questions.",
        bn: "টেস্ট নম্বরে কল করুন — কখনো গ্রাহককে নয়। দেখুন: কলটি CRM-এ দেখা যায়, ২–৩ মিনিটের মধ্যে রেকর্ডিং বাজে এবং সারাংশ আসে। একটি সংক্ষিপ্ত রিজেকশন রিপোর্টও (Not Interested / Wrong Number / Fake) দেখুন — শুধু ছোট প্রশ্নগুলোই আসছে কি না।",
      }),
    },
    {
      title: t({ en: "6. Save the result", bn: "৬. ফলাফল জমা দিন" }),
      body: t({
        en: "Fill the real-call test checklist below and save it. If anything fails, note it in the form and tell IT — do not retry the same test repeatedly.",
        bn: "নিচের আসল কল টেস্ট চেকলিস্টটি পূরণ করে জমা দিন। কিছু ব্যর্থ হলে ফর্মে লিখে IT-কে জানান — একই টেস্ট বারবার করবেন না।",
      }),
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-label="Android APK install guide">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Smartphone className="size-5 text-primary" />
        {t({ en: "Android test app — install guide", bn: "অ্যান্ড্রয়েড টেস্ট অ্যাপ — ইনস্টল গাইড" })}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t({
          en: "Six short steps from the download link to a saved test result.",
          bn: "ডাউনলোড লিংক থেকে টেস্ট ফলাফল জমা দেওয়া পর্যন্ত ছয়টি ছোট ধাপ।",
        })}
      </p>
      <ol className="mt-3 space-y-3">
        {steps.map((s) => (
          <li key={s.title} className="rounded-xl border border-border bg-background/40 p-3">
            <p className="font-medium">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
