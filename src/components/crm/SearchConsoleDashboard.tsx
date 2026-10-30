import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { getSearchConsolePerformance, listSearchConsoleProperties } from "@/lib/search-console.functions";
import { useT } from "@/lib/i18n";
import { pctChange, previousPeriod, validateRange, type DateRange } from "@/lib/search-console-range";

const dhakaDay = (offset: number) => new Date(Date.now() + 6 * 3600_000 - offset * 86400_000).toISOString().slice(0, 10);
type CompareMode = "none" | "previous" | "custom";

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
  const [range, setRange] = useState<DateRange>({ startDate: dhakaDay(30), endDate: dhakaDay(3) });
  const [mode, setMode] = useState<CompareMode>("previous");
  const [custom, setCustom] = useState<DateRange>({ startDate: dhakaDay(58), endDate: dhakaDay(31) });
  const rangeError = validateRange(range, dhakaDay(0)) ?? (mode === "custom" ? validateRange(custom, dhakaDay(0)) : null);
  const perf = useMutation({
    mutationFn: async (siteUrl: string) => {
      const run = (r: DateRange) => perfFn({ data: { adminToken: getAdminToken(), siteUrl, ...r } });
      const other = mode === "none" ? null : mode === "previous" ? previousPeriod(range) : custom;
      const [main, cmp] = await Promise.all([run(range), other ? run(other) : Promise.resolve(null)]);
      return { main, cmp };
    },
  });
  const d = perf.data?.main;
  const c = perf.data?.cmp ?? null;

  return (
    <section className="card-elevated space-y-4 p-5" aria-label="Google search performance">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Search className="size-4 text-primary" />{t({ en: "Google search performance", bn: "Google সার্চ পারফরম্যান্স" })}</h2>
        <p className="text-xs text-muted-foreground">{t({ en: "Clicks, impressions and average ranking from Search Console, for any period, with an optional comparison period. Read-only.", bn: "Search Console থেকে ক্লিক, ইমপ্রেশন ও গড় র‍্যাংকিং — যেকোনো সময়সীমা, চাইলে অন্য সময়ের সাথে তুলনা। শুধু দেখা যাবে।" })}</p>
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
          {props.data && <Button onClick={() => perf.mutate(site)} disabled={!site || perf.isPending || !!rangeError}>{perf.isPending ? "…" : d ? t({ en: "Refresh", bn: "রিফ্রেশ" }) : t({ en: "Show performance", bn: "পারফরম্যান্স দেখুন" })}</Button>}
        </div>
      )}
      {adminToken && props.data && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <RangeInputs label={t({ en: "Period", bn: "সময়সীমা" })} value={range} onChange={(r) => { setRange(r); perf.reset(); }} />
          <label className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground">{t({ en: "Compare with", bn: "তুলনা করুন" })}</span>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={mode} onChange={(e) => { setMode(e.target.value as CompareMode); perf.reset(); }}>
              <option value="previous">{t({ en: "Previous period (same length)", bn: "আগের সমান সময়" })}</option>
              <option value="custom">{t({ en: "Custom period", bn: "নিজের বাছাই করা সময়" })}</option>
              <option value="none">{t({ en: "No comparison", bn: "তুলনা নয়" })}</option>
            </select>
          </label>
          {mode === "custom" && <RangeInputs label={t({ en: "Compare period", bn: "তুলনার সময়" })} value={custom} onChange={(r) => { setCustom(r); perf.reset(); }} />}
          {rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
        </div>
      )}
      {props.data?.length === 0 && <p className="text-sm text-muted-foreground">{t({ en: "No verified properties for the connected Google account.", bn: "সংযুক্ত Google অ্যাকাউন্টে কোনো যাচাইকৃত প্রপার্টি নেই।" })}</p>}
      {(props.error || perf.error) && <p className="text-sm text-destructive">{((props.error ?? perf.error) as Error).message}</p>}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <Stat label={t({ en: "Clicks", bn: "ক্লিক" })} value={String(d.totals.clicks)} change={c ? pctChange(d.totals.clicks, c.totals.clicks) : undefined} prev={c ? String(c.totals.clicks) : undefined} />
            <Stat label={t({ en: "Impressions", bn: "ইমপ্রেশন" })} value={String(d.totals.impressions)} change={c ? pctChange(d.totals.impressions, c.totals.impressions) : undefined} prev={c ? String(c.totals.impressions) : undefined} />
            <Stat label="CTR" value={pct(d.totals.ctr)} change={c ? pctChange(d.totals.ctr, c.totals.ctr) : undefined} prev={c ? pct(c.totals.ctr) : undefined} />
            <Stat label={t({ en: "Avg. position", bn: "গড় অবস্থান" })} value={pos(d.totals.position)} prev={c ? pos(c.totals.position) : undefined} lowerIsBetter change={c && d.totals.position && c.totals.position ? pctChange(d.totals.position, c.totals.position) : c ? null : undefined} />
          </div>
          <p className="text-[11px] text-muted-foreground">{d.startDate} → {d.endDate}{c ? ` vs ${c.startDate} → ${c.endDate}` : ""} · {t({ en: "Google web search only; low-volume rows may be hidden by Google.", bn: "শুধু Google ওয়েব সার্চ; কম সংখ্যার তথ্য Google লুকাতে পারে।" })}</p>
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

function Stat({ label, value, change, prev, lowerIsBetter }: { label: string; value: string; change?: number | null; prev?: string; lowerIsBetter?: boolean }) {
  const good = change != null && change !== 0 && (lowerIsBetter ? change < 0 : change > 0);
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {prev !== undefined && (
        <p className={`text-[11px] ${change == null || change === 0 ? "text-muted-foreground" : good ? "text-success" : "text-destructive"}`}>
          {change == null ? "—" : `${change > 0 ? "+" : ""}${(change * 100).toFixed(0)}%`} · {prev}
        </p>
      )}
    </div>
  );
}

function RangeInputs({ label, value, onChange }: { label: string; value: DateRange; onChange: (r: DateRange) => void }) {
  const cls = "h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm";
  return (
    <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:gap-2">
      <span className="text-muted-foreground sm:w-28">{label}</span>
      <div className="flex items-center gap-2">
        <input type="date" aria-label={`${label} start`} className={cls} value={value.startDate} max={dhakaDay(0)} onChange={(e) => onChange({ ...value, startDate: e.target.value })} />
        <span>→</span>
        <input type="date" aria-label={`${label} end`} className={cls} value={value.endDate} max={dhakaDay(0)} onChange={(e) => onChange({ ...value, endDate: e.target.value })} />
      </div>
    </div>
  );
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
