import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { getSearchConsolePerformance, listSearchConsoleProperties } from "@/lib/search-console.functions";
import { useT } from "@/lib/i18n";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pos = (n: number | null) => (n == null || n === 0 ? "—" : n.toFixed(1));

/** Read-only Google search performance for verified properties (full IT PIN). */
export function SearchConsoleDashboard() {
  const t = useT();
  const adminToken = useAdminToken();
  const [site, setSite] = useState("");
  const listFn = useServerFn(listSearchConsoleProperties);
  const perfFn = useServerFn(getSearchConsolePerformance);
  const props = useMutation({ mutationFn: () => listFn({ data: { adminToken: getAdminToken() } }) });
  const perf = useMutation({ mutationFn: (siteUrl: string) => perfFn({ data: { adminToken: getAdminToken(), siteUrl } }) });
  const d = perf.data;

  return (
    <section className="card-elevated space-y-4 p-5" aria-label="Google search performance">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Search className="size-4 text-primary" />{t({ en: "Google search performance", bn: "Google সার্চ পারফরম্যান্স" })}</h2>
        <p className="text-xs text-muted-foreground">{t({ en: "Clicks, impressions and average ranking from Search Console, latest 28 complete days. Read-only.", bn: "Search Console থেকে ক্লিক, ইমপ্রেশন ও গড় র‍্যাংকিং, সর্বশেষ ২৮ দিন। শুধু দেখা যাবে।" })}</p>
      </div>
      {!adminToken ? <p className="text-sm text-muted-foreground">{t({ en: "Unlock IT Console with the full IT PIN first.", bn: "আগে পূর্ণ IT PIN দিয়ে IT Console খুলুন।" })}</p> : (
        <div className="flex flex-col gap-2 sm:flex-row">
          {props.data ? (
            <select className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={site} onChange={(e) => { setSite(e.target.value); perf.reset(); }} aria-label={t({ en: "Property", bn: "প্রপার্টি" })}>
              <option value="">{t({ en: "Choose a property…", bn: "একটি প্রপার্টি বাছুন…" })}</option>
              {props.data.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <Button variant="outline" onClick={() => props.mutate()} disabled={props.isPending}>{props.isPending ? "…" : t({ en: "Load verified properties", bn: "যাচাইকৃত প্রপার্টি দেখুন" })}</Button>
          )}
          {props.data && <Button onClick={() => perf.mutate(site)} disabled={!site || perf.isPending}>{perf.isPending ? "…" : d ? t({ en: "Refresh", bn: "রিফ্রেশ" }) : t({ en: "Show performance", bn: "পারফরম্যান্স দেখুন" })}</Button>}
        </div>
      )}
      {props.data?.length === 0 && <p className="text-sm text-muted-foreground">{t({ en: "No verified properties for the connected Google account.", bn: "সংযুক্ত Google অ্যাকাউন্টে কোনো যাচাইকৃত প্রপার্টি নেই।" })}</p>}
      {(props.error || perf.error) && <p className="text-sm text-destructive">{((props.error ?? perf.error) as Error).message}</p>}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <Stat label={t({ en: "Clicks", bn: "ক্লিক" })} value={String(d.totals.clicks)} />
            <Stat label={t({ en: "Impressions", bn: "ইমপ্রেশন" })} value={String(d.totals.impressions)} />
            <Stat label="CTR" value={pct(d.totals.ctr)} />
            <Stat label={t({ en: "Avg. position", bn: "গড় অবস্থান" })} value={pos(d.totals.position)} />
          </div>
          <p className="text-[11px] text-muted-foreground">{d.startDate} → {d.endDate} · {t({ en: "Google web search only; low-volume rows may be hidden by Google.", bn: "শুধু Google ওয়েব সার্চ; কম সংখ্যার তথ্য Google লুকাতে পারে।" })}</p>
          {d.daily.length > 0 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.daily}>
                  <XAxis dataKey="key" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="impressions" stroke="var(--chart-2)" dot={false} />
                  <Line type="monotone" dataKey="clicks" stroke="var(--chart-1)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <RankTable title={t({ en: "Top search queries", bn: "শীর্ষ সার্চ" })} rows={d.queries} empty={t({ en: "No query data reported for this period.", bn: "এই সময়ে কোনো সার্চ তথ্য নেই।" })} />
          <RankTable title={t({ en: "Top pages", bn: "শীর্ষ পেজ" })} rows={d.pages} empty={t({ en: "No page data reported for this period.", bn: "এই সময়ে কোনো পেজ তথ্য নেই।" })} />
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-3"><p className="text-xl font-semibold">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>;
}

function RankTable({ title, rows, empty }: { title: string; rows: { key: string; clicks: number; impressions: number; ctr: number; position: number }[]; empty: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ul className="divide-y divide-border text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 break-all">{r.key}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{r.clicks} clicks · {r.impressions} impr. · {pct(r.ctr)} · #{pos(r.position)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
