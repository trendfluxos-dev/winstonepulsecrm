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
    {query.isError ? <p role="alert" className="text-sm text-destructive">{t({ bn: "বণ্টনের তথ্য আনা যায়নি। আবার চেষ্টা করুন।", en: "Could not load the allocation data. Please try again." })}</p> : d && <>
      {!d.distributionOpen && <p role="status" className="text-sm text-muted-foreground">{t({ bn: "আজ শুক্রবার — নতুন লিড বণ্টন বন্ধ; আগের লিডের কাজ চালু থাকবে।", en: "Today is Friday — new lead distribution is paused; work on existing leads continues." })}</p>}
      {d.showZeroAlert && <div role="alert" className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>{surface === "self" ? t({ bn: "আজ আপনি কোনো নতুন লিড পাননি — বণ্টন ঠিক আছে কি না দেখে নেওয়া হবে।", en: "You received no new leads today — the allocation is being checked." }) : t({ bn: `${d.zeroCount} জন এজেন্ট আজ কোনো নতুন লিড পাননি — বণ্টন ঠিক আছে কি না দেখে নেওয়া হবে।`, en: `${d.zeroCount} agents received no new leads today — the allocation is being checked.` })}</p></div>}
      {d.agents.length === 0 ? <p className="text-sm text-muted-foreground">{t({ bn: "কোনো সক্রিয় অনুমোদিত এজেন্ট নেই।", en: "No active approved agents." })}</p> : <>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[{ label: t({ bn: "নতুন লিড বণ্টিত", en: "New leads assigned" }), value: d.total }, { label: t({ bn: "সক্রিয় এজেন্ট", en: "Active agents" }), value: d.agents.length }, { label: t({ bn: "৫০ পূর্ণ করেছেন", en: "Received all 50" }), value: d.completeCount }, { label: t({ bn: "বণ্টন বাকি", en: "Still to assign" }), value: d.remaining }].map(item => <div key={item.label}><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="tabular-nums text-lg font-semibold">{item.value}</dd></div>)}
        </dl>
        <ul className="grid gap-3 md:hidden" aria-label={t({ bn: "এজেন্টভিত্তিক বণ্টন সারাংশ", en: "Per-agent distribution summary" })}>
          {d.agents.map(agent => <li key={agent.id} className="rounded-md border border-border p-3">
            <p className="break-words text-sm font-semibold">{agent.name}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">{t({ bn: "দৈনিক লক্ষ্য", en: "Daily target" })}</dt><dd className="tabular-nums font-semibold">{d.quota}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t({ bn: "লিড পেয়েছেন", en: "Received" })}</dt><dd className={agent.zeroAlert ? "tabular-nums font-semibold text-warning" : "tabular-nums font-semibold"}>{agent.received}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t({ bn: "বাকি", en: "Remaining" })}</dt><dd className="tabular-nums font-semibold">{d.distributionOpen ? agent.remaining : t({ bn: "বণ্টন বন্ধ", en: "Paused" })}</dd></div>
            </dl>
          </li>)}
        </ul>
        <div className="hidden md:block">
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">{t({ bn: "এজেন্টভিত্তিক দৈনিক লক্ষ্য, প্রাপ্ত লিড ও বাকি লিড", en: "Daily target, received leads and remaining leads per agent" })}</caption>
            <thead className="border-b border-border text-xs text-muted-foreground"><tr>
              <th className="w-2/5 py-2 text-left font-medium">{t({ bn: "এজেন্ট", en: "Agent" })}</th>
              <th className="py-2 text-right font-medium">{t({ bn: "দৈনিক লক্ষ্য", en: "Daily target" })}</th>
              <th className="py-2 text-right font-medium">{t({ bn: "লিড পেয়েছেন", en: "Received" })}</th>
              <th className="py-2 text-right font-medium">{t({ bn: "বাকি", en: "Remaining" })}</th>
            </tr></thead>
            <tbody>{d.agents.map(agent => <tr key={agent.id} className="border-b border-border">
              <th scope="row" className="break-words py-3 pr-3 text-left font-medium">{agent.name}</th>
              <td className="py-3 text-right tabular-nums">{d.quota}</td>
              <td className={agent.zeroAlert ? "py-3 text-right tabular-nums font-semibold text-warning" : "py-3 text-right tabular-nums font-semibold"}>{agent.received}</td>
              <td className="py-3 text-right tabular-nums">{d.distributionOpen ? agent.remaining : t({ bn: "বণ্টন বন্ধ", en: "Paused" })}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </>}
  </section>;
}