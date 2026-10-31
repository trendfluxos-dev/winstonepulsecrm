import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { getAndroidBuilds } from "@/lib/github-status.functions";
import { buildEfficiency, runDurationMin } from "@/lib/build-efficiency";
import { useT } from "@/lib/i18n";
import { CRM_REPOSITORY } from "@/lib/github-access";

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Read-only build efficiency over the last 10 Android APK runs (full IT PIN). */
export function BuildEfficiencyDashboard() {
  const t = useT();
  const adminToken = useAdminToken();
  const [repository, setRepository] = useState(CRM_REPOSITORY);
  const [on, setOn] = useState(false);
  const load = useServerFn(getAndroidBuilds);
  const valid = REPO_RE.test(repository.trim());
  const q = useQuery({
    queryKey: ["android-builds", repository.trim()],
    queryFn: () => load({ data: { adminToken: getAdminToken(), repository: repository.trim() } }),
    enabled: on && !!adminToken && valid,
    retry: false,
  });
  const runs = q.data?.runs ?? [];
  const s = buildEfficiency(runs);
  const chart = [...runs].reverse().map((r) => ({ label: fmt(r.startedAt), min: runDurationMin(r) ?? 0, ok: r.conclusion === "success", done: r.status === "completed" }));
  const stat = (label: string, v: string) => <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-semibold">{v}</div></div>;

  return (
    <section className="card-elevated space-y-4 p-5" aria-label="Build efficiency">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Gauge className="size-4 text-primary" />{t({ en: "Build efficiency", bn: "Build দক্ষতা" })}</h2>
        <p className="text-xs text-muted-foreground">{t({ en: "Last 10 Android APK builds from GitHub: start, finish, duration and result. Times in Dhaka. Read-only.", bn: "GitHub থেকে শেষ ১০টি Android APK build: শুরু, শেষ, সময় ও ফলাফল। ঢাকা সময়। শুধু দেখা যায়।" })}</p>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (!valid) return; on ? void q.refetch() : setOn(true); }}>
        <Input value={repository} maxLength={200} onChange={(e) => { setRepository(e.target.value); setOn(false); }} placeholder="owner/repository" aria-label={t({ en: "Repository", bn: "রিপোজিটরি" })} />
        <Button type="submit" disabled={!adminToken || !valid || q.isFetching}>{t({ en: "Load history", bn: "ইতিহাস দেখুন" })}</Button>
      </form>
      {!adminToken && <p className="text-sm text-muted-foreground">{t({ en: "Unlock IT Console with the full IT PIN first.", bn: "আগে পূর্ণ IT PIN দিয়ে IT Console খুলুন।" })}</p>}
      {q.isError && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && runs.length === 0 && <p className="text-sm text-muted-foreground">{t({ en: "No builds have run yet.", bn: "এখনো কোনো build চলেনি।" })}</p>}
      {runs.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {stat(t({ en: "Success rate", bn: "সফলতার হার" }), s.successRate === null ? "—" : `${s.successRate}% (${s.succeeded}/${s.completed})`)}
            {stat(t({ en: "Average time", bn: "গড় সময়" }), s.avgMinutes === null ? "—" : `${s.avgMinutes} min`)}
            {stat(t({ en: "Fastest", bn: "দ্রুততম" }), s.fastestMinutes === null ? "—" : `${s.fastestMinutes} min`)}
            {stat(t({ en: "Slowest", bn: "ধীরতম" }), s.slowestMinutes === null ? "—" : `${s.slowestMinutes} min`)}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="m" />
                <Tooltip />
                <Bar dataKey="min" name="minutes">{chart.map((c, i) => <Cell key={i} fill={!c.done ? "var(--muted-foreground)" : c.ok ? "var(--primary)" : "var(--destructive)"} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="divide-y rounded-md border text-sm">
            {runs.map((r) => {
              const d = runDurationMin(r);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 p-2">
                  <Badge variant={r.status !== "completed" ? "secondary" : r.conclusion === "success" ? "default" : "destructive"}>
                    {r.status !== "completed" ? t({ en: "Running", bn: "চলছে" }) : r.conclusion === "success" ? t({ en: "Success", bn: "সফল" }) : r.conclusion ?? "—"}
                  </Badge>
                  <span>{t({ en: "Start", bn: "শুরু" })} {fmt(r.startedAt)}</span>
                  <span>· {t({ en: "Finish", bn: "শেষ" })} {r.status === "completed" ? fmt(r.updatedAt) : "—"}</span>
                  <span>· {d === null ? "—" : `${d} min`}</span>
                  <a className="ml-auto text-primary underline" href={r.url} target="_blank" rel="noreferrer">{r.sha}</a>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
