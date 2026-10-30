import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { ArrowDown, ChevronLeft, ChevronRight, Crown, Medal } from "lucide-react";
import { topPerformerToday, topPerformerOnDate } from "@/lib/top-performer.functions";
import { shiftPerformanceDate } from "@/lib/performance-history";
import { explainPoints, sortBoard, summarizeBoard, type BoardRow, type SortKey } from "@/lib/performance-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useT } from "@/lib/i18n";
import { Bi } from "@/components/crm/Bi";
import { SCORE_FORMULA } from "@/lib/performance-audit";

type ResultsData = { dateKey: string; generatedAt?: string; revealAt?: string; revealed: boolean; topThree: BoardRow[]; otherAgents: BoardRow[] };

const STALE_MS = 3 * 60_000;
const timeOf = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }) : "—";
const dayOf = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "long", year: "numeric" });
const n = (v: number) => (Number.isInteger(v) ? v : v.toFixed(1));

const performanceQuery = queryOptions({
  queryKey: ["public-daily-performance"],
  queryFn: async () => {
    try { return (await topPerformerToday()) as unknown as ResultsData; }
    catch { return null; }
  },
  staleTime: 60_000,
  refetchInterval: 60_000,
  retry: 1,
});

export function DailyPerformance() {
  return (
    <section className="mt-12 rounded-2xl border border-border bg-card p-4 shadow-soft sm:mt-16 sm:p-7" aria-labelledby="daily-performance-title">
      <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading…</p>}>
        <PerformanceResults />
      </Suspense>
    </section>
  );
}

function PerformanceResults() {
  const t = useT();
  const { data, dataUpdatedAt } = useSuspenseQuery(performanceQuery);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = data?.dateKey;
  const date = selectedDate ?? today ?? "";
  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-ink"><Bi en="Sales Leaderboard" bn="সেলস লিডারবোর্ড" /></p>
          <h2 id="daily-performance-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl"><Bi en="Daily Sales Performance" bn="দৈনিক সেলস পারফরম্যান্স" /></h2>
          {date && <p className="mt-1 text-sm text-muted-foreground">{dayOf(date)}</p>}
        </div>
        {today && (
          <div className="flex flex-wrap items-end gap-2">
            <Input aria-label={t({ en: "Results date", bn: "ফলাফলের তারিখ" })} className="h-9 w-40" type="date" value={date} max={today} onChange={(e) => { if (e.target.value && e.target.value <= today) setSelectedDate(e.target.value === today ? null : e.target.value); }} />
            <Button variant="outline" size="icon" className="size-9" aria-label={t({ en: "Previous day", bn: "আগের দিন" })} onClick={() => setSelectedDate(shiftPerformanceDate(date, -1))}><ChevronLeft aria-hidden /></Button>
            <Button variant="outline" size="icon" className="size-9" disabled={date >= today} aria-label={t({ en: "Next day", bn: "পরের দিন" })} onClick={() => { const next = shiftPerformanceDate(date, 1); setSelectedDate(next >= today ? null : next); }}><ChevronRight aria-hidden /></Button>
            {selectedDate !== null && <Button variant="plate" size="sm" onClick={() => setSelectedDate(null)}>{t({ en: "Latest", bn: "সর্বশেষ" })}</Button>}
          </div>
        )}
      </header>
      {!data ? <ErrorState /> : (
        <Suspense fallback={<p role="status" className="mt-6 text-sm text-muted-foreground">{t({ en: "Loading results…", bn: "ফলাফল আসছে…" })}</p>}>
          {date === data.dateKey ? <Board data={data} fetchedAt={dataUpdatedAt} live /> : <HistoricalResults key={date} date={date} />}
        </Suspense>
      )}
      <details className="mt-6 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">{t({ en: "How the score works", bn: "স্কোর কীভাবে হিসাব হয়" })}</summary>
        <p className="mt-2 leading-relaxed">Score = {SCORE_FORMULA}. Audio and sync delays contribute no points or penalties. Historical results are recalculated from saved activity and current assignment state, not locked snapshots. Top 3 needs real activity and no more than 30% of the day's assigned leads still pending.</p>
      </details>
    </div>
  );
}

function ErrorState() {
  const t = useT();
  return <p role="alert" className="mt-6 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{t({ en: "Results could not be loaded. Nothing is shown rather than showing zeros — try again shortly.", bn: "ফলাফল আনা যায়নি। শূন্য দেখানোর বদলে কিছুই দেখানো হচ্ছে না — একটু পরে আবার চেষ্টা করুন।" })}</p>;
}

function HistoricalResults({ date }: { date: string }) {
  const { data, dataUpdatedAt } = useSuspenseQuery(queryOptions({
    queryKey: ["public-daily-performance", date],
    queryFn: async () => { try { return (await topPerformerOnDate({ data: { date } })) as ResultsData; } catch { return null; } },
    staleTime: 300_000,
    retry: 1,
  }));
  return data ? <Board data={data} fetchedAt={dataUpdatedAt} /> : <ErrorState />;
}

function Board({ data, fetchedAt, live = false }: { data: ResultsData; fetchedAt: number; live?: boolean }) {
  const t = useT();
  const [sort, setSort] = useState<SortKey>("score");
  const [open, setOpen] = useState<BoardRow | null>(null);
  const rows = useMemo(() => [...data.topThree, ...data.otherAgents].sort((a, b) => a.rank - b.rank), [data]);
  const sorted = useMemo(() => sortBoard(rows, sort), [rows, sort]);
  const s = summarizeBoard(rows);
  const stale = live && Date.now() - fetchedAt > STALE_MS;

  const times = (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span><span className="font-medium text-foreground">{t({ en: "Scheduled report", bn: "নির্ধারিত রিপোর্ট" })}:</span> 5:30 PM · Dhaka</span>
      <span><span className="font-medium text-foreground">{t({ en: "Data refreshed", bn: "তথ্য হালনাগাদ" })}:</span> {timeOf(data.generatedAt)} · Dhaka</span>
      {!live && <span>{t({ en: "Recalculated from saved activity", bn: "সংরক্ষিত কাজ থেকে পুনরায় হিসাব" })}</span>}
      {stale && <span role="status" className="text-destructive">{t({ en: "Data may be out of date", bn: "তথ্য পুরোনো হতে পারে" })}</span>}
    </div>
  );

  if (!data.revealed) return <>{times}<p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t({ en: "Today's results will appear at 5:30 PM Dhaka.", bn: "আজকের ফলাফল বিকেল ৫:৩০-এ (ঢাকা) দেখা যাবে।" })}</p></>;

  const kpis: [string, string | number][] = [
    [t({ en: "Eligible agents", bn: "যোগ্য এজেন্ট" }), s.agents],
    [t({ en: "Completed leads", bn: "সম্পন্ন লিড" }), s.completed],
    [t({ en: "Reports", bn: "রিপোর্ট" }), s.reports],
    [t({ en: "Call attempts", bn: "কলের চেষ্টা" }), s.called],
    [t({ en: "Verified connected", bn: "যাচাইকৃত সংযোগ" }), s.connected],
    [t({ en: "Follow-ups done", bn: "ফলো-আপ সম্পন্ন" }), s.followUps],
    [t({ en: "Highest score", bn: "সর্বোচ্চ স্কোর" }), s.highestScore === null ? "—" : n(s.highestScore)],
  ];
  const cols: { key: SortKey; label: string }[] = [
    { key: "completed", label: t({ en: "Completed", bn: "সম্পন্ন" }) },
    { key: "reports", label: t({ en: "Reports", bn: "রিপোর্ট" }) },
    { key: "called", label: t({ en: "Calls", bn: "কল" }) },
    { key: "connected", label: t({ en: "Connected", bn: "সংযোগ" }) },
    { key: "followUps", label: t({ en: "Follow-ups", bn: "ফলো-আপ" }) },
    { key: "score", label: t({ en: "Points", bn: "পয়েন্ট" }) },
  ];

  return (
    <div aria-live="polite">
      {times}
      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4 lg:grid-cols-7">
        {kpis.map(([label, value]) => (
          <div key={label} className="bg-card px-3 py-3">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Bi en="Top 3" bn="সেরা ৩" /></h3>
      {data.topThree.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border p-8 text-center">
          <Medal aria-hidden className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">{t({ en: "No qualifying Top 3 results yet", bn: "সেরা তিনের যোগ্য ফলাফল এখনো নেই" })}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t({ en: "Top 3 appears only when agents have real saved activity and meet the pending-lead rule.", bn: "সংরক্ষিত কাজ ও পেন্ডিং-লিড নিয়ম পূরণ হলেই সেরা ৩ দেখা যাবে।" })}</p>
        </div>
      ) : (
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {data.topThree.map((a, i) => {
            const tone = ["border-gold text-gold-ink", "border-silver text-silver", "border-bronze text-bronze"][i] ?? "border-border text-muted-foreground";
            return (
              <li key={a.agentId} className={`md:order-none ${i === 0 ? "md:order-2" : i === 1 ? "md:order-1" : "md:order-3"}`}>
                <button type="button" onClick={() => setOpen(a)} className={`w-full rounded-xl border-t-2 border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40 ${tone.split(" ")[0]} ${i === 0 ? "md:-mt-2 md:pb-6" : "md:mt-4"}`}>
                  <div className={`flex items-center justify-between text-xs font-semibold ${tone.split(" ")[1]}`}>
                    <span>#{i + 1}</span>{i === 0 ? <Crown aria-hidden className="size-4" /> : <Medal aria-hidden className="size-4" />}
                  </div>
                  <p className="mt-3 truncate text-base font-semibold">{a.name}</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">{n(a.score)}<span className="ml-1 text-xs font-normal text-muted-foreground">{t({ en: "pts", bn: "পয়েন্ট" })}</span></p>
                  <p className="mt-2 text-xs text-muted-foreground">{a.completed} {t({ en: "completed", bn: "সম্পন্ন" })} · {a.called} {t({ en: "calls", bn: "কল" })} · {a.connected} {t({ en: "connected", bn: "সংযোগ" })} · {a.reports} {t({ en: "reports", bn: "রিপোর্ট" })}</p>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Bi en="All agents" bn="সব এজেন্ট" /></h3>
        <label className="flex items-center gap-2 text-xs text-muted-foreground md:hidden">
          {t({ en: "Sort", bn: "সাজান" })}
          <select className="h-8 rounded-md border border-border bg-background px-2 text-foreground" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
      </div>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t({ en: "No saved activity for this day.", bn: "এই দিনের সংরক্ষিত কাজ নেই।" })}</p> : (
        <>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border md:hidden">
            {sorted.map((a) => (
              <li key={a.agentId}>
                <button type="button" onClick={() => setOpen(a)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/40">
                  <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground tabular-nums">{a.rank}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.name}</span><span className="block text-xs text-muted-foreground">{a.completed} · {a.reports} · {a.called} · {a.connected} · {a.followUps}</span></span>
                  <span className="text-base font-semibold tabular-nums">{n(a.score)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">{t({ en: "Agent", bn: "এজেন্ট" })}</th>
                  {cols.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-right font-medium" aria-sort={sort === c.key ? "descending" : "none"}>
                      <button type="button" onClick={() => setSort(c.key)} className={`inline-flex items-center gap-1 ${sort === c.key ? "text-foreground" : ""}`}>{c.label}{sort === c.key && <ArrowDown aria-hidden className="size-3" />}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((a) => (
                  <tr key={a.agentId} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen(a)}>
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{a.rank}</td>
                    <td className="px-3 py-2.5 font-medium"><button type="button" className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); setOpen(a); }}>{a.name}</button></td>
                    {cols.map((c) => <td key={c.key} className={`px-3 py-2.5 text-right tabular-nums ${c.key === "score" ? "font-semibold" : ""}`}>{n(a[c.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <AgentDetail agent={open} date={data.dateKey} onClose={() => setOpen(null)} />
    </div>
  );
}

function AgentDetail({ agent, date, onClose }: { agent: BoardRow | null; date: string; onClose: () => void }) {
  const t = useT();
  const e = agent ? explainPoints(agent) : null;
  return (
    <Sheet open={!!agent} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md">
        {agent && e && (
          <>
            <SheetHeader className="pr-8">
              <SheetTitle>{agent.name}</SheetTitle>
              <SheetDescription>#{agent.rank} · {dayOf(date)}</SheetDescription>
            </SheetHeader>
            <table className="mt-6 w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-1 text-left font-medium">{t({ en: "Activity", bn: "কাজ" })}</th><th className="py-1 text-right font-medium">{t({ en: "Count", bn: "সংখ্যা" })}</th><th className="py-1 text-right font-medium">×</th><th className="py-1 text-right font-medium">{t({ en: "Points", bn: "পয়েন্ট" })}</th></tr></thead>
              <tbody className="divide-y divide-border">
                {e.lines.map((l) => <tr key={l.key}><td className="py-2">{t({ en: l.en, bn: l.bn })}</td><td className="py-2 text-right tabular-nums">{l.count}</td><td className="py-2 text-right tabular-nums text-muted-foreground">{l.weight}</td><td className="py-2 text-right tabular-nums">{n(l.points)}</td></tr>)}
              </tbody>
              <tfoot><tr className="border-t-2 border-gold"><td className="py-2 font-semibold" colSpan={3}>{t({ en: "Total", bn: "মোট" })}</td><td className="py-2 text-right text-lg font-semibold tabular-nums">{n(e.total)}</td></tr></tfoot>
            </table>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t({ en: "Counts come from this agent's saved reports, calls, follow-ups and assigned leads for the selected Dhaka day. Audio and sync delays add or remove nothing.", bn: "সংখ্যাগুলো নির্বাচিত ঢাকা দিনের সংরক্ষিত রিপোর্ট, কল, ফলো-আপ ও অ্যাসাইন লিড থেকে নেওয়া। অডিও বা সিঙ্ক দেরি কিছু যোগ বা বাদ দেয় না।" })}</p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
