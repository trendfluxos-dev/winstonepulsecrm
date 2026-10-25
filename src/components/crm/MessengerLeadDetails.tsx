import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, UserRound } from "lucide-react";
import { useT, useLang } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { getMessengerLeadDetails } from "@/lib/messenger.functions";
import { messengerLeadLookupAllowed } from "@/lib/messenger-lead-details";

export function MessengerLeadDetails({ connected, thread }: { connected: boolean; thread: { id: string; storedMessageId?: string } }) {
  const t = useT();
  const lang = useLang();
  const adminToken = useAdminToken();
  const fetchDetails = useServerFn(getMessengerLeadDetails);
  const allowed = messengerLeadLookupAllowed(connected, thread);
  const q = useQuery({ queryKey: ["messenger-linked-lead", thread.id, thread.storedMessageId, adminToken],
    queryFn: () => fetchDetails({ data: { adminToken, messageId: thread.storedMessageId ?? "" } }),
    enabled: allowed, staleTime: 0, gcTime: 0, retry: false });
  const result = allowed ? q.data : null;
  const lead = result?.ok ? result.lead : null;
  const empty = !connected ? { bn: "Meta সিঙ্ক চালু নয়—লিডের তথ্য দেখানো হচ্ছে না।", en: "Meta sync inactive—lead details are not displayed." }
    : !allowed ? { bn: "এই কথোপকথনে সংরক্ষিত মেসেজের লিংক নেই; ডেমো থেকে লিড খোঁজা হয় না।", en: "No saved message link; demo conversations never look up CRM leads." }
    : result && !result.ok && result.code === "UNLINKED" ? { bn: "পর্যালোচিত মেসেজটি এখনও কোনো লিডের সঙ্গে যুক্ত নয়।", en: "This message has not been linked to a reviewed lead." }
    : { bn: "লিডের তথ্য পাওয়া যায়নি অথবা আপনার প্রবেশাধিকার নেই।", en: "Lead details are unavailable or outside your access." };
  return <aside aria-labelledby="messenger-lead-heading" className="min-w-0 space-y-3 border-t border-border pt-4 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
    <h2 id="messenger-lead-heading" className="flex items-center gap-2 text-sm font-semibold"><UserRound className="size-4 text-primary" />{t({ bn: "সংযুক্ত লিডের বিস্তারিত", en: "Linked lead details" })}</h2>
    {allowed && q.isFetching ? <p className="text-xs text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p> : lead ? <dl className="space-y-3 text-sm">
      {[
        { label: { bn: "নাম", en: "Name" }, value: lead.name },
        { label: { bn: "ফোন", en: "Phone" }, value: lead.phone },
        { label: { bn: "ঠিকানা", en: "Address" }, value: lead.address },
        { label: { bn: "সংরক্ষিত উৎস", en: "Saved source" }, value: lead.source },
        { label: { bn: "লিডের অবস্থা", en: "Lead status" }, value: lead.status },
        { label: { bn: "আগ্রহের মাত্রা", en: "Temperature" }, value: lead.temperature },
        { label: { bn: "গ্রেড", en: "Grade" }, value: lead.grade },
        { label: { bn: "মেসেজের সময় (ঢাকা)", en: "Message time (Dhaka)" }, value: new Date(lead.arrivedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" }) },
      ].map((field) => <div key={field.label.en}><dt className="text-xs text-muted-foreground">{t(field.label)}</dt><dd className="break-words font-medium">{field.value || "—"}</dd></div>)}
    </dl> : <p className="flex items-start gap-2 text-xs text-muted-foreground"><Lock className="mt-0.5 size-4 shrink-0" />{t(empty)}</p>}
  </aside>;
}