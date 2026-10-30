import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useT } from "@/lib/i18n";

type L = { en: string; bn: string };
const ITEMS: { title: L; hint: L }[] = [
  { title: { en: "Source: link came directly from IT/HQ", bn: "উৎস: লিংক সরাসরি IT/HQ থেকে এসেছে" }, hint: { en: "Downloads open on github.com under the Winstone repository. Never install a forwarded or WhatsApp file.", bn: "ডাউনলোড github.com-এ Winstone রিপোজিটরিতে খোলে। ফরওয়ার্ড বা WhatsApp ফাইল কখনো ইনস্টল করবেন না।" } },
  { title: { en: "File: name ends in .apk and matches what IT told you", bn: "ফাইল: নাম .apk-এ শেষ এবং IT যা বলেছে তার সঙ্গে মেলে" }, hint: { en: "If the file asks to install from another app store or has a different name, stop and ask IT.", bn: "অন্য অ্যাপ স্টোর থেকে ইনস্টল করতে বললে বা নাম আলাদা হলে থামুন ও IT-কে জিজ্ঞেস করুন।" } },
  { title: { en: "Version: matches the version IT announced", bn: "সংস্করণ: IT ঘোষিত সংস্করণের সঙ্গে মেলে" }, hint: { en: "After install, check Settings → Apps → Winstone Pulse → App version.", bn: "ইনস্টলের পর সেটিংস → অ্যাপস → Winstone Pulse → অ্যাপ সংস্করণ দেখুন।" } },
  { title: { en: "Install permission: allowed only for this install", bn: "ইনস্টল অনুমতি: শুধু এই ইনস্টলের জন্য" }, hint: { en: "Allow \"Install unknown apps\" for your browser, then turn it off again after installing.", bn: "ব্রাউজারের জন্য \"অজানা অ্যাপ ইনস্টল\" চালু করুন, ইনস্টলের পর আবার বন্ধ করুন।" } },
  { title: { en: "App permissions: only Phone, Call logs, Microphone, Notifications", bn: "অ্যাপ অনুমতি: শুধু ফোন, কল লগ, মাইক্রোফোন, নোটিফিকেশন" }, hint: { en: "If it asks for contacts, SMS, location or accessibility, deny and report it to IT.", bn: "কন্টাক্ট, SMS, লোকেশন বা অ্যাক্সেসিবিলিটি চাইলে না দিন ও IT-কে জানান।" } },
];

/** Local-only pre-install safety checklist. Nothing is saved or sent. */
export function ApkPreInstallChecklist() {
  const t = useT();
  const [done, setDone] = useState<boolean[]>(ITEMS.map(() => false));
  const all = done.every(Boolean);
  return <section className="card-elevated space-y-3 p-5" aria-label="Before installing the APK">
    <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" />{t({ en: "Before you install — safety check", bn: "ইনস্টলের আগে — নিরাপত্তা যাচাই" })}</h2>
    <ul className="space-y-2">{ITEMS.map((it, i) => <li key={i}>
      <label className="flex gap-3 rounded-md border p-3 text-sm">
        <Checkbox className="mt-0.5" checked={done[i]} onCheckedChange={(v) => setDone((p) => p.map((x, j) => (j === i ? v === true : x)))} />
        <span><span className="font-medium">{t(it.title)}</span><span className="block text-xs text-muted-foreground">{t(it.hint)}</span></span>
      </label></li>)}</ul>
    <p className={all ? "text-sm font-medium text-primary" : "text-xs text-muted-foreground"}>
      {all ? t({ en: "All checks done — safe to install.", bn: "সব যাচাই শেষ — ইনস্টল করা নিরাপদ।" }) : t({ en: `${done.filter(Boolean).length} of ${ITEMS.length} checked. If any item fails, don't install — contact IT.`, bn: `${ITEMS.length}টির মধ্যে ${done.filter(Boolean).length}টি যাচাই হয়েছে। কোনোটি না মিললে ইনস্টল করবেন না — IT-কে জানান।` })}
    </p>
  </section>;
}
