import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLeadPoolNotice } from "@/lib/lead-pool-notice.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

const SEEN = "hq-lead-pool-notice-seen";

/** Pop-up on HQ when the daily auto hand-out could not fill every agent (empty/low pool or failure). Dismiss hides it for this browser session only; the alert itself stays open for IT. */
export function LeadPoolNotice() {
  const t = useT();
  const adminToken = useAdminToken();
  const read = useServerFn(getLeadPoolNotice);
  const q = useQuery({ queryKey: ["hq-lead-pool-notice", adminToken], queryFn: () => read({ data: { adminToken } }), refetchInterval: 5 * 60_000 });
  const [seen, setSeen] = useState<string[] | null>(null);
  useEffect(() => { try { setSeen(JSON.parse(sessionStorage.getItem(SEEN) ?? "[]")); } catch { setSeen([]); } }, []);
  const d = q.data;
  const live = d && d.shortage
    ? [{ id: `live-${d.workDate}-${d.pool}-${d.need}`, created_at: new Date().toISOString(),
        title: t({ bn: `লিড পুলে পর্যাপ্ত লিড নেই — আছে ${d.pool}টি, দরকার ${d.need}টি`, en: `Not enough leads in the pool — ${d.pool} available, ${d.need} needed` }),
        detail: t({ bn: `${d.from} – ${d.to}: ১৪ দিনের মধ্যে ${d.allocationDays}টি বণ্টন দিন (শুক্রবার ও ছুটি বাদ)। ${d.agents} জনের দৈনিক মোট লক্ষ্য ${d.dailyNeed}; দরকার ${d.need}টি, কম ${d.shortfall}টি।`, en: `${d.from} – ${d.to}: ${d.allocationDays} allocation days in 14 calendar days (excluding Friday and holidays). ${d.agents} agents' combined daily target: ${d.dailyNeed}; need ${d.need}, shortfall ${d.shortfall}.` }),
        action: t({ bn: "IT Console → লিড ডেটাবেজে নতুন লিড আপলোড করুন।", en: "Upload new leads in IT Console → Lead database." }) }]
    : [];
  const fresh = [...live, ...(d?.alerts ?? [])].filter((a) => seen && !seen.includes(a.id));
  if (q.isError) return <p role="alert" className="text-sm text-destructive">{t({ bn: "লিড পুল সতর্কতার হিসাব পড়া যায়নি।", en: "Lead pool warning unavailable." })}</p>;
  if (!fresh.length) return null;
  const close = () => {
    const next = [...(seen ?? []), ...fresh.map((a) => a.id)];
    sessionStorage.setItem(SEEN, JSON.stringify(next));
    setSeen(next);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8"><AlertTriangle className="size-5 text-warning" aria-hidden />{t({ bn: "দৈনিক লিড বণ্টন: লিড পুল নোটিশ", en: "Daily lead hand-out: lead pool notice" })}</DialogTitle>
          <DialogDescription>{t({ bn: `ব্যবহারযোগ্য লিড: ${d?.pool ?? "—"}টি। নির্ধারিত বণ্টন সকাল ৯:১০ (ঢাকা), শুক্রবার বাদ। এটি ১৪ দিনের চাহিদার সতর্কতা, বণ্টনের প্রমাণ নয়।`, en: `Usable leads: ${d?.pool ?? "—"}. Scheduled allocation: 9:10 AM Dhaka, excluding Friday. This is a 14-day supply warning, not proof of assignment.` })}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
          {fresh.map((a) => (
            <li key={a.id} className="border-l-2 border-warning pl-3 text-sm">
              <p className="font-semibold">{a.title}</p>
              {a.detail && <p className="mt-1 text-muted-foreground">{a.detail}</p>}
              {a.action && <p className="mt-1 text-xs">{a.action}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</p>
            </li>
          ))}
        </ul>
        {live.length > 0 && <dl className="grid grid-cols-2 gap-2 text-xs">{d?.rows.map((a) => <div key={a.id}><dt className="font-medium">{a.name}</dt><dd className="text-muted-foreground">{a.dailyTarget}/day × {d.allocationDays} = {a.need}</dd></div>)}</dl>}
        <DialogFooter><Button onClick={close}>{t({ bn: "বুঝেছি", en: "Got it" })}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
