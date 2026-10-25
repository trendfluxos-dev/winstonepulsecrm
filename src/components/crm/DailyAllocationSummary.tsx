import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDailyAllocation } from "@/lib/daily-allocation.functions";
import { useAdminToken, useDeckToken } from "@/lib/local-session";
import { useMyAccount } from "@/lib/session";
import { useT } from "@/lib/i18n";

export function DailyAllocationSummary({ surface }: { surface: "hq" | "leadhub" | "self" }) {
  const t = useT();
  const authorityToken = useAdminToken();
  const deckToken = useDeckToken();
  const { account } = useMyAccount();
  const adminToken = surface === "leadhub" ? deckToken : surface === "hq" ? authorityToken : null;
  const read = useServerFn(getDailyAllocation);
  const query = useQuery({
    queryKey: ["daily-new-allocation", surface, adminToken, account?.profile?.id],
    queryFn: () => read({ data: { surface, adminToken } }),
    refetchInterval: 60_000,
    retry: false,
  });
  const d = query.data;
  return <section className="min-w-0 space-y-3 border-y border-border py-4" aria-label={t({ bn: "দৈনিক নতুন লিড বণ্টন", en: "Daily new lead distribution" })}>
    <header className="flex items-start justify-between gap-3">
      <div><h2 className="text-sm font-semibold">{t({ bn: "দৈনিক নতুন লিড বণ্টন", en: "Daily new lead distribution" })}</h2>
        <p className="text-xs text-muted-foreground">{d ? `${d.day} · ${t({ bn: "ঢাকা সময়", en: "Dhaka time" })}` : t({ bn: "তথ্য আনা হচ্ছে…", en: "Loading…" })}</p></div>
      <Button size="icon" variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()} aria-label={t({ bn: "বণ্টন সারাংশ আবার দেখুন", en: "Refresh allocation summary" })} title={t({ bn: "আবার দেখুন", en: "Refresh" })}><RefreshCw className={query.isFetching ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} /></Button>
    </header>
    {query.isError ? <p role="alert" className="text-sm text-destructive">{t({ bn: "বণ্টনের তথ্য যাচাই করা যায়নি। আবার দেখুন।", en: "Allocation could not be verified. Please refresh." })}</p> : d && <>
      {!d.distributionOpen && <p role="status" className="text-sm text-muted-foreground">{t({ bn: "আজ শুক্রবার — নতুন লিড বণ্টন বন্ধ; আগের লিডের কাজ চালু থাকবে।", en: "Friday — new distribution is paused; existing lead work continues." })}</p>}
      {d.showZeroAlert && <div role="alert" className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>{surface === "self" ? t({ bn: "আজ আপনি কোনো নতুন লিড পাননি। LeadHub-এর বণ্টন যাচাই প্রয়োজন।", en: "You have received no new leads today. LeadHub distribution needs checking." }) : t({ bn: `${d.zeroCount} জন সক্রিয় এজেন্ট আজ নতুন লিড পাননি। LeadHub-এর বণ্টন যাচাই প্রয়োজন।`, en: `${d.zeroCount} active agents have received no new leads today. Check LeadHub distribution.` })}</p></div>}
      {d.agents.length === 0 ? <p className="text-sm text-muted-foreground">{t({ bn: "কোনো সক্রিয় অনুমোদিত এজেন্ট নেই।", en: "No active approved agents." })}</p> : <>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[{ label: t({ bn: "নতুন লিড বণ্টিত", en: "New leads assigned" }), value: d.total }, { label: t({ bn: "সক্রিয় এজেন্ট", en: "Active agents" }), value: d.agents.length }, { label: t({ bn: "৫০ পূর্ণ করেছেন", en: "Received all 50" }), value: d.completeCount }, { label: t({ bn: "বণ্টন বাকি", en: "Still to assign" }), value: d.remaining }].map(item => <div key={item.label}><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="tabular-nums text-lg font-semibold">{item.value}</dd></div>)}
        </dl>
        {surface !== "self" && <ul className="grid gap-2 md:grid-cols-2" aria-label={t({ bn: "এজেন্টভিত্তিক বণ্টন সারাংশ", en: "Per-agent distribution summary" })}>{d.agents.map(agent => <li key={agent.id} className="flex min-w-0 items-center justify-between gap-3 border-b border-border py-2 text-sm"><span className="min-w-0 break-words font-medium">{agent.name}</span><span className="shrink-0 text-right"><span className={agent.received === 0 && d.distributionOpen ? "tabular-nums font-semibold text-warning" : "tabular-nums font-semibold"}>{agent.received}/{d.quota}</span><span className="block text-xs text-muted-foreground">{!d.distributionOpen ? t({ bn: "বণ্টন বন্ধ", en: "Paused" }) : t({ bn: `বাকি ${agent.remaining}`, en: `${agent.remaining} remaining` })}</span></span></li>)}</ul>}
      </>}
    </>}
  </section>;
}