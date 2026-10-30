import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";
import { captureDbPerformanceSnapshot, getDbPerformanceSnapshots } from "@/lib/db-performance.functions";

/** Database performance over time from saved snapshots (full IT PIN). Credits/active hours are not readable from inside the app. */
export function DbPerformanceDashboard() {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const read = useServerFn(getDbPerformanceSnapshots);
  const capture = useServerFn(captureDbPerformanceSnapshot);
  const q = useQuery({ queryKey: ["db-perf", adminToken], queryFn: () => read({ data: { adminToken } }), enabled: !!adminToken });
  const rows = q.data ?? [];
  const chrono = [...rows].reverse();
  const points = chrono.map((r, i) => {
    const prev = chrono[i - 1];
    const dCalls = prev ? r.total_calls - prev.total_calls : 0;
    const dMs = prev ? r.total_exec_ms - prev.total_exec_ms : 0;
    return {
      at: new Date(r.captured_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      sizeMb: Math.round(r.db_size_bytes / 1048576),
      avgMs: prev && dCalls > 0 && dMs >= 0 ? Math.round((dMs / dCalls) * 100) / 100 : null,
    };
  });
  const latest = rows[0];

  async function snap() {
    try { await capture({ data: { adminToken } }); toast.success(t({ en: "Snapshot saved", bn: "স্ন্যাপশট সংরক্ষিত" })); qc.invalidateQueries({ queryKey: ["db-perf"] }); }
    catch { toast.error(t({ en: "Could not save snapshot", bn: "স্ন্যাপশট সংরক্ষণ হয়নি" })); }
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Database className="size-4 text-primary" />{t({ en: "Database usage over time", bn: "সময়ভিত্তিক ডাটাবেস ব্যবহার" })}</h2>
        <Button size="sm" onClick={snap} disabled={!adminToken}><RefreshCw className="size-4" />{t({ en: "Take snapshot", bn: "স্ন্যাপশট নিন" })}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{t({ en: "Active hours and credit spend can't be read from inside the app — see Settings → Plans & credit usage. This panel tracks database size and query speed from saved snapshots.", bn: "সক্রিয় ঘণ্টা ও ক্রেডিট খরচ অ্যাপ থেকে পড়া যায় না — Settings → Plans & credit usage দেখুন। এখানে সংরক্ষিত স্ন্যাপশট থেকে ডাটাবেসের আকার ও কোয়েরির গতি দেখানো হয়।" })}</p>
      {!adminToken ? <p className="text-sm text-muted-foreground">{t({ en: "Full IT PIN required.", bn: "পূর্ণ IT PIN প্রয়োজন।" })}</p>
        : q.isError ? <p className="text-sm text-destructive">{t({ en: "Could not load snapshots.", bn: "স্ন্যাপশট লোড হয়নি।" })}</p>
        : rows.length === 0 ? <p className="text-sm text-muted-foreground">{t({ en: "No snapshots yet. Take the first one.", bn: "এখনও স্ন্যাপশট নেই। প্রথমটি নিন।" })}</p>
        : (<>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <Stat label={t({ en: "Database size", bn: "ডাটাবেস আকার" })} value={`${Math.round(latest!.db_size_bytes / 1048576)} MB`} />
            <Stat label={t({ en: "Queries counted", bn: "গণনাকৃত কোয়েরি" })} value={latest!.total_calls.toLocaleString()} />
            <Stat label={t({ en: "Snapshots", bn: "স্ন্যাপশট" })} value={String(rows.length)} />
          </div>
          {points.length > 1 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="at" fontSize={10} /><YAxis yAxisId="l" fontSize={10} /><YAxis yAxisId="r" orientation="right" fontSize={10} /><Tooltip />
                  <Line yAxisId="l" dataKey="avgMs" name={t({ en: "Avg ms per query", bn: "গড় ms" })} stroke="hsl(var(--primary))" dot={false} connectNulls />
                  <Line yAxisId="r" dataKey="sizeMb" name="MB" stroke="hsl(var(--muted-foreground))" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{t({ en: "Slowest queries (latest snapshot)", bn: "সবচেয়ে ধীর কোয়েরি (সর্বশেষ)" })}</h3>
            <ul className="divide-y divide-border rounded-md border text-xs">
              {latest!.top_queries.map((x, i) => (
                <li key={i} className="space-y-0.5 p-2"><span className="block break-all font-mono text-muted-foreground">{x.query}</span><span>{Number(x.calls).toLocaleString()} {t({ en: "calls", bn: "বার" })} · {x.mean_ms} ms {t({ en: "avg", bn: "গড়" })} · {Math.round(Number(x.total_ms) / 1000)} s {t({ en: "total", bn: "মোট" })}</span></li>
              ))}
            </ul>
          </div>
        </>)}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div>;
}
