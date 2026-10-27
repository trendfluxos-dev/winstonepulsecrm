import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Trophy } from "lucide-react";
import { topPerformerToday } from "@/lib/top-performer.functions";
import { useT } from "@/lib/i18n";
import { Bi } from "@/components/crm/Bi";

const performanceQuery = queryOptions({
  queryKey: ["public-daily-performance"],
  queryFn: () => topPerformerToday(),
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
  const { data } = useSuspenseQuery({
    ...performanceQuery,
    queryFn: async () => {
      try { return await topPerformerToday(); }
      catch { return null; }
    },
  });
  if (!data) return <p className="mt-6 text-sm text-muted-foreground">{t({ en: "Results are temporarily unavailable.", bn: "ফলাফল এখন দেখা যাচ্ছে না।" })}</p>;
  if (!data.revealed) return <p className="mt-6 text-sm text-muted-foreground">{t({ en: "Today's results will appear at 5:30 PM.", bn: "আজকের ফলাফল বিকেল ৫:৩০-এ দেখা যাবে।" })}</p>;
  const rows = [...data.topThree, ...data.otherAgents];
  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">{data.dateKey}</p>
      {data.topThree.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.topThree.map((agent, index) => (
            <article key={agent.agentId} className="min-w-0 rounded-lg border border-gold/50 bg-card p-5">
              <div className="flex items-center justify-between gap-3 text-gold">
                <span className="text-sm font-semibold">#{index + 1}</span><Trophy aria-hidden className="size-5" />
              </div>
              <h3 className="mt-4 break-words text-lg font-semibold">{agent.name}</h3>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{agent.score} <span className="text-xs font-normal text-muted-foreground">{t({ en: "points", bn: "পয়েন্ট" })}</span></p>
              <p className="mt-3 text-xs text-muted-foreground">{t({ en: "Completed", bn: "শেষ হয়েছে" })}: {agent.completed}/{agent.targetQuota} · {agent.completionPercent}%</p>
              <p className="mt-2 text-xs text-muted-foreground">{agent.reports} {t({ en: "reports", bn: "রিপোর্ট" })} · {agent.followUps} {t({ en: "follow-ups", bn: "ফলো-আপ" })}</p>
            </article>
          ))}
        </div>
      ) : <p className="mt-4 text-sm text-muted-foreground">{t({ en: "No qualifying Top 3 results yet.", bn: "সেরা তিনের যোগ্য ফলাফল এখনো নেই।" })}</p>}
      {data.otherAgents.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold"><Bi en="Other agents" bn="অন্যান্য এজেন্ট" /></h3>
          <ul className="mt-3 divide-y divide-border">
            {data.otherAgents.map((agent) => (
              <li key={agent.agentId} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0"><p className="break-words text-sm font-semibold">{agent.name}</p><p className="mt-1 text-xs text-muted-foreground">{t({ en: "Completed", bn: "শেষ হয়েছে" })}: {agent.completed}/{agent.targetQuota}</p></div>
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