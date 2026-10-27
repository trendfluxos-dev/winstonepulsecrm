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
  const fresh = (q.data?.alerts ?? []).filter((a) => seen && !seen.includes(a.id));
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
          <DialogDescription>{t({ bn: `ডেটাবেজে এখন ব্যবহারযোগ্য লিড: ${q.data?.pool ?? "—"}টি। পুলে লিড থাকলে প্রতিদিন সকাল ৯:১০ (ঢাকা) স্বয়ংক্রিয়ভাবে সবাইকে লিড দেওয়া হয়।`, en: `Usable leads in the database now: ${q.data?.pool ?? "—"}. When the pool has leads, every agent is auto-assigned daily at 9:10 AM (Dhaka).` })}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {fresh.map((a) => (
            <li key={a.id} className="border-l-2 border-warning pl-3 text-sm">
              <p className="font-semibold">{a.title}</p>
              {a.detail && <p className="mt-1 text-muted-foreground">{a.detail}</p>}
              {a.action && <p className="mt-1 text-xs">{a.action}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</p>
            </li>
          ))}
        </ul>
        <DialogFooter><Button onClick={close}>{t({ bn: "বুঝেছি", en: "Got it" })}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
