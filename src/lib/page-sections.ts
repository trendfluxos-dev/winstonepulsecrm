import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";

/** Sub-pages of the three big workspaces, shared by the sidebar and each page. */
export const PAGE_SECTIONS = {
  "/hq": [
    { key: "overview", label: "সারকথো", en: "Summary" },
    { key: "kpis", label: "এজেন্ট KPI ড্যাশবোর্ড", en: "Agent KPI dashboard" },
    { key: "lead360", label: "লিডের পুরো নথি", en: "Lead details" },
    { key: "followups", label: "ফলো-আপ ও রিপোর্ট", en: "Follow-ups & reports" },
    { key: "performance", label: "এজেন্টেদের কাজ", en: "Agent work" },
    { key: "leads", label: "লিড ও ধাপ", en: "Leads & stages" },
    { key: "tools", label: "তদারকি ও সরঞ্জাম", en: "Checks & tools" },
  ],
  "/desk": [
    { key: "today", label: "আজকের কাজ", en: "Today's work" },
    { key: "pipeline", label: "কাজের ধাপ", en: "Work stages" },
    { key: "leads", label: "আমার লিড", en: "My leads" },
    { key: "tasks", label: "কাজ", en: "Tasks" },
    { key: "activities", label: "কাজের নথি", en: "Work log" },
    { key: "queue", label: "সহজ কার্ড", en: "Simple cards" },
    { key: "calls", label: "কল রেকর্ড", en: "Call records" },
    { key: "whatsapp", label: "হোয়াটসঅ্যাপ", en: "WhatsApp" },
    { key: "messenger", label: "মেসেঞ্জার", en: "Messenger" },
    { key: "calendar", label: "পররমোর তারিখ", en: "Next dates" },
    { key: "outlook", label: "আজকের অবস্থা", en: "Today's status" },
    { key: "reports", label: "আমার রিপোর্ট", en: "My reports" },
    { key: "support", label: "দলের সাপোর্ট", en: "Team support" },
  ],
  "/sales-intel": [
    { key: "pitchbook", label: "বিক্রয়ের প্রস্তুতি", en: "Sales prep" },
    { key: "objections", label: "কথার জবাব সংগ্রহ", en: "Answer library" },
    { key: "history", label: "কথার ইতিহাস", en: "Talk history" },
    { key: "market", label: "বাজারের তথ্য", en: "Market info" },
    { key: "effectiveness", label: "কথার ফল", en: "What worked" },
    { key: "admin", label: "তথ্য ব্যবস্থা", en: "Manage info" },
  ],
  "/system": [
    { key: "health", label: "সিস্টেমের অবস্থা", en: "System check" },
    { key: "leads", label: "লিডের তালিকো", en: "Lead list" },
    { key: "calls", label: "কল ও রেকর্ডিং", en: "Calls & recordings" },
    { key: "knowledge", label: "জানার ভান্ডার (ওয়েবসাইট ও ড্রাইভ)", en: "Knowledge (Website & Drive)" },
    { key: "notices", label: "নোটিশ ও সাপোর্ট", en: "Notices & support" },
    { key: "access", label: "অ্যাকোউন্ট ও অ্যাক্সেস", en: "Accounts & access" },
    { key: "releases", label: "অ্যাপ ও সংস্করণ", en: "Apps & versions" },
    { key: "billing", label: "বিল ও তদারকি", en: "Billing & review" },
  ],
} as const;

export type SectionRoute = keyof typeof PAGE_SECTIONS;
export type SectionKey<R extends SectionRoute> = (typeof PAGE_SECTIONS)[R][number]["key"];

export const sectionSearch = (
  s: Record<string, unknown>,
): { s?: string; lead?: string; from?: string; to?: string } => ({
  ...(typeof s["from"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["from"]) ? { from: s["from"] } : {}),
  ...(typeof s["to"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["to"]) ? { to: s["to"] } : {}),
  ...(typeof s["s"] === "string" ? { s: s["s"] } : {}),
  ...(typeof s["lead"] === "string" && /^[0-9a-f-]{36}$/i.test(s["lead"]) ? { lead: s["lead"] } : {}),
});

export function useSection<R extends SectionRoute>(route: R): [SectionKey<R>, (k: SectionKey<R>) => void] {
  const raw = useRouterState({ select: (st) => String((st.location.search as Record<string, unknown>)["s"] ?? "") });
  const list = PAGE_SECTIONS[route] as readonly { key: string }[];
  const current = (list.find((x) => x.key === raw)?.key ?? list[0]!.key) as SectionKey<R>;
  const navigate = useNavigate();
  const set = useCallback(
    (k: SectionKey<R>) => {
      void navigate({ to: route, search: { s: k } } as never);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [navigate, route],
  );
  return [current, set];
}
