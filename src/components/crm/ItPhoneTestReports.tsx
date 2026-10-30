import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { getItPhoneTestReports } from "@/lib/phone-test-report.functions";
import { useT } from "@/lib/i18n";

/** IT inbox of agent phone test reports (full IT PIN). Read-only. */
export function ItPhoneTestReports() {
  const t = useT();
  const adminToken = useAdminToken();
  const [open, setOpen] = useState(false);
  const load = useServerFn(getItPhoneTestReports);
  const q = useQuery({ queryKey: ["it-phone-test-reports"], queryFn: () => load({ data: { adminToken: getAdminToken() ?? "" } }), enabled: open && !!adminToken, retry: false });
  return <section className="card-elevated space-y-3 p-5" aria-label="Phone test reports for IT">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold"><Inbox className="size-4 text-primary" />{t({ en: "Phone test reports from agents", bn: "এজেন্টদের ফোন টেস্ট রিপোর্ট" })}</h2>
      <Button size="sm" variant="outline" disabled={!adminToken || q.isFetching} onClick={() => (open ? void q.refetch() : setOpen(true))}>{open ? t({ en: "Refresh", bn: "রিফ্রেশ" }) : t({ en: "Show reports", bn: "রিপোর্ট দেখুন" })}</Button>
    </div>
    {!adminToken && <p className="text-sm text-muted-foreground">{t({ en: "Unlock IT Console with the full IT PIN first.", bn: "আগে পূর্ণ IT PIN দিয়ে IT Console খুলুন।" })}</p>}
    {q.isError && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
    {q.data && q.data.length === 0 && <p className="text-sm text-muted-foreground">{t({ en: "No reports sent to IT yet.", bn: "এখনো IT-তে কোনো রিপোর্ট আসেনি।" })}</p>}
    {q.data && q.data.length > 0 && <ul className="divide-y divide-border text-sm">{q.data.map((r) => <li key={r.id} className="space-y-1 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={r.failedCount ? "destructive" : "default"}>{r.failedCount ? t({ en: `${r.failedCount} failed`, bn: `${r.failedCount}টি ফেল` }) : t({ en: "All passed", bn: "সব পাস" })}</Badge>
        <span>{r.agent} · {r.phoneModel}{r.appVersion ? ` · v${r.appVersion}` : ""}</span>
        <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })}</span>
      </div>
      {r.failedCount > 0 && <p className="text-xs text-muted-foreground">{Object.entries(r.results).filter(([, v]) => v === "fail").map(([k]) => k.replace(/_/g, " ")).join(", ")}</p>}
      {r.issue && <p className="whitespace-pre-wrap">{r.issue}</p>}
    </li>)}</ul>}
  </section>;
}
