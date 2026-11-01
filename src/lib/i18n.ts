import { useSyncExternalStore } from "react";

/** UI language. English is the default; Bengali is a full alternative. A saved choice always wins. */
export type Lang = "bn" | "en";
const KEY = "winstone.lang";
const listeners = new Set<() => void>();

/** English is the primary language; Bengali is used only when it was explicitly saved. */
export function langFromStored(stored: string | null): Lang {
  return stored === "bn" ? "bn" : "en";
}

function read(): Lang {
  if (typeof window === "undefined") return "en";
  return langFromStored(window.localStorage.getItem(KEY));
}

export function setLang(lang: Lang) {
  window.localStorage.setItem(KEY, lang);
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      document.documentElement.lang = read();
      return () => listeners.delete(cb);
    },
    read,
    () => "en",
  );
}

/** Pick the right string: t({ bn, en }). */
export function useT() {
  const lang = useLang();
  return (s: { bn: string; en: string }) => s[lang];
}

export const NAV_LABELS: Record<string, { bn: string; en: string }> = {
  "/": { bn: "হোম", en: "Home" },
  "/desk": { bn: "আমার কাজ", en: "My Work" },
  "/recorder": { bn: "কল রেকর্ড ও নোট", en: "Call Records & Notes" },
  "/coach": { bn: "এআই প্রশিক্ষক", en: "AI Coach" },
  "/leadhub": { bn: "লিড হাব (সব লিড)", en: "Lead Hub (all leads)" },
  "/hq": { bn: "HQ (সবার হিসাব)", en: "HQ (team overview)" },
  "/contributions": { bn: "এজেন্টের অবদান", en: "Agent Contributions" },
  "/audit-log": { bn: "তদারকির নথি", en: "Review Log" },
  "/staff-portal": { bn: "স্টাফ তালিকা", en: "Staff List" },
  "/live-leads": { bn: "চলমান লিড", en: "Live Leads" },
  "/booking-review": { bn: "বুকিং অনুমোদন", en: "Booking Approval" },
  "/sales-intel": { bn: "বিক্রয়ের তথ্য", en: "Sales Info" },
  "/news": { bn: "বাজারের খবর", en: "Market News" },
  "/site-visits": { bn: "সাইট পরিদর্শন", en: "Site Visits" },
  "/projects": { bn: "আবাসন প্রজেক্ট", en: "Projects" },
  "/inventory": { bn: "ঘর ও দামের তালিকা", en: "Homes & Prices" },
  "/unit-board": { bn: "ঘর ও বুকিং", en: "Homes & Bookings" },
  "/qualify": { bn: "WhatsApp কাস্টমার যাচাই", en: "WhatsApp Customer Check" },
  "/reports": { bn: "দৈনিক হিসাব", en: "Daily Reports" },
  "/facebook-ads": { bn: "Facebook বিজ্ঞাপনের হিসাব", en: "Facebook Ads Report" },
  "/integrations": { bn: "কোন সংযোগ কাজ করছো", en: "Connection Status" },
  "/meta-control-center": { bn: "Meta নিয়ন্ত্রণ", en: "Meta Control" },
  "/system": { bn: "আইটি কনসোল (সেটিংস)", en: "IT Console (settings)" },
  "/runtime-errors": { bn: "সিস্টেমের সমস্যা", en: "System Problems" },
  "/load-diagnostics": { bn: "পেজ লোড সমস্যা", en: "Page-load Diagnostics" },
  "/sync-failures": { bn: "ফোন সিঙ্ক সমস্যা", en: "Android Sync Failures" },
  "/ingest": { bn: "নতুন লিড আসার পরীক্ষা", en: "New Lead Check" },
  "/migration": { bn: "ডেটা সরানোর চেকলিস্ট", en: "Data Move Checklist" },
  "/migration-export": { bn: "ডেটা এক্সপোর্ট", en: "Data Export" },
  "/security": { bn: "পিন ও অ্যাক্সেস", en: "PIN & Access" },
  "/docs": { bn: "নথি ও নির্দেশনা", en: "Guides" },
  "/docs-admin": { bn: "নথি সম্পাদনা", en: "Edit Guides" },
  "/messenger": { bn: "Messenger বার্তা", en: "Messenger Messages" },
  "/inbox": { bn: "সাপোর্ট বার্তা", en: "Support Messages" },
  "/tickets": { bn: "সাপোর্ট অনুরোধ", en: "Support Requests" },
  "/customers": { bn: "গ্রাহক", en: "Customers" },
  "/support-admin": { bn: "সাপোর্ট ব্যবস্থা", en: "Support Setup" },
  "/help": { bn: "সহায্যের কেন্দ্র", en: "Help Centre" },
  "/walkthrough": { bn: "সিস্টেম শিখুন", en: "Learn the System" },
};
