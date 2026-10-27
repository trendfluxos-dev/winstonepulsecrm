import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { topPerformerToday, topPerformerOnDate } from "@/lib/top-performer.functions";
import { shiftPerformanceDate } from "@/lib/performance-history";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { Bi } from "@/components/crm/Bi";

const performanceQuery = queryOptions({
  queryKey: ["public-daily-performance"],
  queryFn: async () => {
    try { return await topPerformerToday(); }
    catch { return null; }
  },
  staleTime: 60_000,
  refetchInterval: 60_000,
  retry: 1,
});

export function DailyPerformance() {
  return (
    <section className="mt-12 border-t border-border pt-9 sm:mt-16 sm:pt-12" aria-labelledby="daily-performance-title">
      <h2 id="daily-performance-title" className="font-hand text-4xl font-semibold sm:text-5xl">
        <Bi en="Daily Task Performance" bn="প্রতিদিনের কাজের ফলাফল" />
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">5:30 PM · Asia/Dhaka</p>
      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Loading…</p>}>
        <PerformanceResults />
      </Suspense>
    </section>
  );
}

function PerformanceResults() {
  const t = useT();
  const { data } = useSuspenseQuery(performanceQuery);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  if (!data) return <p className="mt-6 text-sm text-muted-foreground">{t({ en: "Results are temporarily unavailable.", bn: "ফলাফল এখন দেখা যাচ্ছে না।" })}</p>;
  const date = selectedDate ?? data.dateKey;
  return (
    <div>
      <div className="mt-6 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 sm:max-w-52">
          <label htmlFor="performance-history-date" className="mb-2 block text-sm font-medium"><Bi en="Results date" bn="ফলাফলের তারিখ" /></label>
          <Input id="performance-history-date" type="date" value={date} max={data.dateKey} onChange={(event) => { if (event.target.value && event.target.value <= data.dateKey) setSelectedDate(event.target.value); }} />
        </div>
        <Button variant="outline" size="icon" aria-label={t({ en: "Previous day", bn: "আগের দিন" })} title={t({ en: "Previous day", bn: "আগের দিন" })} onClick={() => setSelectedDate(shiftPerformanceDate(date, -1))}><ChevronLeft aria-hidden /></Button>
        <Button variant="outline" size="icon" disabled={date >= data.dateKey} aria-label={t({ en: "Next day", bn: "পরের দিন" })} title={t({ en: "Next day", bn: "পরের দিন" })} onClick={() => setSelectedDate(shiftPerformanceDate(date, 1))}><ChevronRight aria-hidden /></Button>
        {selectedDate !== null && <Button variant="plate" onClick={() => setSelectedDate(null)}>{t({ en: "Latest", bn: "সর্বশেষ" })}</Button>}
      </div>
      {date !== data.dateKey && <p className="mt-3 text-xs text-muted-foreground">{t({ en: "Historical results · calculated from saved activity", bn: "পুরোনো ফলাফল · সংরক্ষিত কাজ থেকে হিসাব করা" })}</p>}
      <Suspense fallback={<p role="status" className="mt-6 text-sm text-muted-foreground">{t({ en: "Loading results…", bn: "ফলাফল আসছে…" })}</p>}>
        {date === data.dateKey ? <ResultsBoard data={data} /> : <HistoricalResults key={date} date={date} />}
      </Suspense>
    </div>
  );
}

function HistoricalResults({ date }: { date: string }) {
  const { data } = useSuspenseQuery(queryOptions({
    queryKey: ["public-daily-performance", date],
    queryFn: async () => { try { return await topPerformerOnDate({ data: { date } }); } catch { return null; } },
    staleTime: 300_000,
    retry: 1,
  }));
  return <ResultsBoard data={data} />;
}

type ResultsData = { dateKey: string; revealed: boolean; topThree: { agentId: string; name: string; score: number; completed: number; reports: number; followUps: number }[]; otherAgents: { agentId: string; name: string; score: number; completed: number; reports: number; followUps: number }[] };

function ResultsBoard({ data }: { data: ResultsData | null }) {
  const t = useT();
  if (!data) return <p role="status" className="mt-6 text-sm text-muted-foreground">{t({ en: "Results are temporarily unavailable.", bn: "ফলাফল এখন দেখা যাচ্ছে না।" })}</p>;
  if (!data.revealed) return <p className="mt-6 text-sm text-muted-foreground">{t({ en: "Today's results will appear at 5:30 PM.", bn: "আজকের ফলাফল বিকেল ৫:৩০-এ দেখা যাবে।" })}</p>;
  const rows = [...data.topThree, ...data.otherAgents];
  const highlighted = data.topThree.length ? data.topThree : data.otherAgents.filter((agent) => agent.score > 0 || agent.completed > 0).slice(0, 3);
  const highlightedIds = new Set(highlighted.map((agent) => agent.agentId));
  const remaining = rows.filter((agent) => !highlightedIds.has(agent.agentId));
  return (
    <div className="mt-6" aria-live="polite">
      <p className="text-sm text-muted-foreground">{data.dateKey}</p>
      {highlighted.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {highlighted.map((agent, index) => (
            <article key={agent.agentId} className="min-w-0 rounded-lg border border-gold/50 bg-card p-5">
              <div className="flex items-center justify-between gap-3 text-gold">
                <span className="text-sm font-semibold">#{index + 1}</span><Trophy aria-hidden className="size-5" />
              </div>
              <h3 className="mt-4 break-words text-lg font-semibold">{agent.name}</h3>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{agent.score} <span className="text-xs font-normal text-muted-foreground">{t({ en: "points", bn: "পয়েন্ট" })}</span></p>
              <p className="mt-3 text-xs text-muted-foreground">{t({ en: "Completed", bn: "শেষ হয়েছে" })}: {agent.completed}</p>
              <p className="mt-2 text-xs text-muted-foreground">{agent.reports} {t({ en: "reports", bn: "রিপোর্ট" })} · {agent.followUps} {t({ en: "follow-ups", bn: "ফলো-আপ" })}</p>
            </article>
          ))}
        </div>
      ) : <p className="mt-4 text-sm text-muted-foreground">{t({ en: "No qualifying Top 3 results yet.", bn: "সেরা তিনের যোগ্য ফলাফল এখনো নেই।" })}</p>}
      {remaining.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold"><Bi en="Other agents" bn="অন্যান্য এজেন্ট" /></h3>
          <ul className="mt-3 divide-y divide-border">
            {remaining.map((agent) => (
              <li key={agent.agentId} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0"><p className="break-words text-sm font-semibold">{agent.name}</p><p className="mt-1 text-xs text-muted-foreground">{t({ en: "Completed", bn: "শেষ হয়েছে" })}: {agent.completed}</p></div>
                <span className="shrink-0 text-right text-lg font-semibold tabular-nums">{agent.score}<span className="block text-xs font-normal text-muted-foreground">{t({ en: "points", bn: "পয়েন্ট" })}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {rows.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{t({ en: "No saved results for this day.", bn: "এই দিনের ফলাফল সংরক্ষিত নেই।" })}</p>}
    </div>
  );
}