import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Pencil, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getDailyAllocation, setAgentDailyTarget } from "@/lib/daily-allocation.functions";
import { useAdminToken, useDeckToken } from "@/lib/local-session";
import { useMyAccount } from "@/lib/session";
import { useT } from "@/lib/i18n";

type Row = { id: string; name: string; received: number; target: number; percent: number; remaining: number; zeroAlert: boolean };

function TargetEditor({ row, adminToken, onDone }: { row: Row; adminToken: string | null; onDone: () => void }) {
  const t = useT();
  const [value, setValue] = useState(String(row.target));
  const save = useServerFn(setAgentDailyTarget);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => save({ data: { adminToken, agentId: row.id, target: Number(value) } }),
    onSuccess: () => { toast.success(t({ bn: "লক্ষ্য সংরক্ষিত", en: "Target saved" })); void qc.invalidateQueries({ queryKey: ["daily-new-allocation"] }); onDone(); },
    onError: () => toast.error(t({ bn: "লক্ষ্য সংরক্ষণ হয়নি (১–৫০)", en: "Target not saved (1–50)" })),
  });
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= 50;
  return <div className="flex items-center gap-1">
    <Input type="number" min={1} max={50} inputMode="numeric" value={value} onChange={e => setValue(e.target.value)} className="h-9 w-20" aria-label={t({ bn: `${row.name}-এর দৈনিক লক্ষ্য`, en: `${row.name} daily target` })} />
    <Button size="icon" variant="ghost" disabled={!valid || m.isPending} onClick={() => m.mutate()} aria-label={t({ bn: "সংরক্ষণ", en: "Save" })}><Check className="size-4" /></Button>
    <Button size="icon" variant="ghost" onClick={onDone} aria-label={t({ bn: "বাতিল", en: "Cancel" })}><X className="size-4" /></Button>
  </div>;
}

export function DailyAllocationSummary({ surface }: { surface: "hq" | "leadhub" | "self" }) {
  const t = useT();
  const authorityToken = useAdminToken();
  const deckToken = useDeckToken();
  const { account } = useMyAccount();
  const adminToken = surface === "leadhub" ? deckToken : surface === "hq" ? authorityToken : null;
  const read = useServerFn(getDailyAllocation);
  const [editing, setEditing] = useState<string | null>(null);
  const canEdit = surface === "hq";
  const query = useQuery({
    queryKey: ["daily-new-allocation", surface, adminToken, account?.profile?.id],
    queryFn: () => read({ data: { surface, adminToken } }),
    refetchInterval: 60_000,
    retry: false,
  });
  const d = query.data;
  const targetCell = (row: Row) => editing === row.id
    ? <TargetEditor row={row} adminToken={authorityToken} onDone={() => setEditing(null)} />
    : <span className="inline-flex items-center gap-1 tabular-nums font-semibold">{row.target}{canEdit && <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(row.id)} aria-label={t({ bn: `${row.name}-এর লক্ষ্য বদলান`, en: `Edit ${row.name} target` })}><Pencil className="size-3.5" /></Button>}</span>;
  const bar = (row: Row) => <div className="space-y-1"><Progress value={row.percent} className="h-2" aria-label={t({ bn: `${row.name} লক্ষ্যের ${row.percent}%`, en: `${row.name} ${row.percent}% of target` })} /><p className="text-xs tabular-nums text-muted-foreground">{row.percent}% {t({ bn: "পূরণ", en: "filled" })}</p></div>;
  return <section className="min-w-0 space-y-3 border-y border-border py-4" aria-label={t({ bn: "দৈনিক নতুন লিড বণ্টন", en: "Daily new lead distribution" })}>
    <header className="flex items-start justify-between gap-3">
      <div><h2 className="text-sm font-semibold">{t({ bn: "দৈনিক নতুন লিড বণ্টন", en: "Daily new lead distribution" })}</h2>
        <p className="text-xs text-muted-foreground">{d ? `${d.day} · ${t({ bn: "ঢাকা সময় · লক্ষ্য সর্বোচ্চ ৫০", en: "Dhaka time · targets max 50" })}` : t({ bn: "তথ্য আনা হচ্ছে…", en: "Loading…" })}</p></div>
      <Button size="icon" variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()} aria-label={t({ bn: "বণ্টন সারাংশ আবার দেখুন", en: "Refresh allocation summary" })} title={t({ bn: "আবার দেখুন", en: "Refresh" })}><RefreshCw className={query.isFetching ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} /></Button>
    </header>
    {query.isError ? <p role="alert" className="text-sm text-destructive">{t({ bn: "বণ্টনের তথ্য যাচাই করা যায়নি। আবার দেখুন।", en: "Allocation could not be verified. Please refresh." })}</p> : d && <>
      {!d.distributionOpen && <p role="status" className="text-sm text-muted-foreground">{t({ bn: "আজ শুক্রবার — নতুন লিড বণ্টন বন্ধ; আগের লিডের কাজ চালু থাকবে।", en: "Friday — new distribution is paused; existing lead work continues." })}</p>}
      {d.showZeroAlert && <div role="alert" className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>{surface === "self" ? t({ bn: "আজ আপনি কোনো নতুন লিড পাননি। LeadHub-এর বণ্টন যাচাই প্রয়োজন।", en: "You have received no new leads today. LeadHub distribution needs checking." }) : t({ bn: `${d.zeroCount} জন সক্রিয় এজেন্ট আজ নতুন লিড পাননি। LeadHub-এর বণ্টন যাচাই প্রয়োজন।`, en: `${d.zeroCount} active agents have received no new leads today. Check LeadHub distribution.` })}</p></div>}
      {d.agents.length === 0 ? <p className="text-sm text-muted-foreground">{t({ bn: "কোনো সক্রিয় অনুমোদিত এজেন্ট নেই।", en: "No active approved agents." })}</p> : <>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[{ label: t({ bn: "নতুন লিড বণ্টিত", en: "New leads assigned" }), value: d.total }, { label: t({ bn: "সক্রিয় এজেন্ট", en: "Active agents" }), value: d.agents.length }, { label: t({ bn: "লক্ষ্য পূরণ করেছেন", en: "Reached target" }), value: d.completeCount }, { label: t({ bn: "বণ্টন বাকি", en: "Still to assign" }), value: d.remaining }].map(item => <div key={item.label}><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="tabular-nums text-lg font-semibold">{item.value}</dd></div>)}
        </dl>
        <ul className="grid gap-3 md:hidden" aria-label={t({ bn: "এজেন্টভিত্তিক বণ্টন সারাংশ", en: "Per-agent distribution summary" })}>
          {d.agents.map(agent => <li key={agent.id} className="space-y-3 rounded-md border border-border p-3">
            <p className="break-words text-sm font-semibold">{agent.name}</p>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">{t({ bn: "দৈনিক লক্ষ্য", en: "Daily target" })}</dt><dd>{targetCell(agent)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t({ bn: "লিড পেয়েছেন", en: "Received" })}</dt><dd className={agent.zeroAlert ? "tabular-nums font-semibold text-warning" : "tabular-nums font-semibold"}>{agent.received}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t({ bn: "বাকি", en: "Remaining" })}</dt><dd className="tabular-nums font-semibold">{d.distributionOpen ? agent.remaining : t({ bn: "বণ্টন বন্ধ", en: "Paused" })}</dd></div>
            </dl>
            {bar(agent)}
          </li>)}
        </ul>
        <div className="hidden md:block">
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">{t({ bn: "এজেন্টভিত্তিক দৈনিক লক্ষ্য, প্রাপ্ত লিড, বাকি ও পূরণ-শতাংশ", en: "Daily target, received, remaining and fill percent per agent" })}</caption>
            <thead className="border-b border-border text-xs text-muted-foreground"><tr>
              <th className="w-1/4 py-2 text-left font-medium">{t({ bn: "এজেন্ট", en: "Agent" })}</th>
              <th className="py-2 text-right font-medium">{t({ bn: "দৈনিক লক্ষ্য", en: "Daily target" })}</th>
              <th className="py-2 text-right font-medium">{t({ bn: "লিড পেয়েছেন", en: "Received" })}</th>
              <th className="py-2 text-right font-medium">{t({ bn: "বাকি", en: "Remaining" })}</th>
              <th className="w-1/4 py-2 pl-4 text-left font-medium">{t({ bn: "অগ্রগতি", en: "Progress" })}</th>
            </tr></thead>
            <tbody>{d.agents.map(agent => <tr key={agent.id} className="border-b border-border">
              <th scope="row" className="break-words py-3 pr-3 text-left font-medium">{agent.name}</th>
              <td className="py-3 text-right">{targetCell(agent)}</td>
              <td className={agent.zeroAlert ? "py-3 text-right tabular-nums font-semibold text-warning" : "py-3 text-right tabular-nums font-semibold"}>{agent.received}</td>
              <td className="py-3 text-right tabular-nums">{d.distributionOpen ? agent.remaining : t({ bn: "বণ্টন বন্ধ", en: "Paused" })}</td>
              <td className="py-3 pl-4">{bar(agent)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </>}
  </section>;
}
