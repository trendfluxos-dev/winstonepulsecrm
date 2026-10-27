import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { commandCenterFeedQuery, useSnapshot } from "@/lib/crm-data";
import { getCommandCenterFeed } from "@/lib/command-center.functions";
import { useAdminToken } from "@/lib/local-session";
import { agentKpiRows } from "@/lib/agent-kpi-board";
import { rangeError, type DayRange } from "@/lib/kpi-contract";
import { dhakaDay } from "@/lib/lead-groups";
import { useT } from "@/lib/i18n";

/** Mounted only inside HQ; consumes the existing server-authorized floor feeds. */
export function AgentKpiDashboard() {
  const t = useT();
  const snapshot = useSnapshot();
  const token = useAdminToken();
  const client = useQueryClient();
  const read = useServerFn(getCommandCenterFeed);
  const feed = useQuery(commandCenterFeedQuery(client, token, read));
  const [mode, setMode] = useState<"today" | "all" | "custom">("today");
  const [custom, setCustom] = useState({ from: dhakaDay(new Date()), to: dhakaDay(new Date()) });
  const today = dhakaDay(new Date());
  const range: DayRange = mode === "all" ? { from: null, to: null } : mode === "today" ? { from: today, to: today } : custom;
  const error = rangeError(range);
  const period = mode === "all" ? t({ bn: "সব সময়", en: "All time" }) : `${range.from} → ${range.to}`;
  const agents = snapshot.profiles.filter((p) => p.is_active && p.approval_status === "approved" && (p.role === "agent" || p.role === "team_leader"));
  const rows = useMemo(() => agentKpiRows(agents, snapshot.leads, feed.data?.reports ?? [], feed.data?.followUps ?? [], range, new Date()), [snapshot.profiles, snapshot.leads, feed.data, range.from, range.to]);
  return <section className="space-y-5" aria-label="Agent KPI dashboard">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Users className="size-5 text-primary" />{t({ bn: "এজেন্ট KPI ড্যাশবোর্ড", en: "Agent KPI dashboard" })}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{period} · Asia/Dhaka</p>
        <p className="text-xs text-muted-foreground">{t({ bn: "লিডের বর্তমান অবস্থা · রিপোর্ট জমা দেওয়ার তারিখ · বর্তমান ফলো-আপ", en: "Current lead state · reports by submitted date · current follow-ups" })}</p></div>
      <Button variant="outline" size="icon" aria-label="Refresh agent KPIs" title="Refresh agent KPIs" disabled={feed.isFetching} onClick={() => { void feed.refetch(); snapshot.refetch(); }}><RefreshCw className="size-4" /></Button>
    </header>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Report date range">
      {(["today", "all", "custom"] as const).map((m) => <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "today" ? t({ bn: "আজ", en: "Today" }) : m === "all" ? t({ bn: "সব সময়", en: "All time" }) : t({ bn: "তারিখ", en: "Custom" })}</Button>)}
      {mode === "custom" && <><input aria-label="Report start date" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="rounded-md border border-input bg-background px-2 text-sm" /><input aria-label="Report end date" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="rounded-md border border-input bg-background px-2 text-sm" /></>}
    </div>
    {error ? <p role="alert" className="text-destructive">{error}</p> : snapshot.readError || feed.isError ? <p role="alert" className="text-destructive">{t({ bn: "হিসাব পড়া যায়নি। পুনরায় চেষ্টা করুন।", en: "KPI counts unavailable. Please refresh." })}</p> : snapshot.isPending || feed.isPending ? <p role="status">{t({ bn: "হিসাব লোড হচ্ছে…", en: "Loading agent KPIs…" })}</p> : <>
      <p className="text-xs text-muted-foreground">{t({ bn: "শেষ রিপোর্ট পড়া", en: "Reports read" })}: {feed.data?.freshness.generatedAt ? new Date(feed.data.freshness.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : "—"} · {t({ bn: "লিড পড়া", en: "Leads read" })}: {snapshot.snapshotTime ? new Date(snapshot.snapshotTime).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : "—"}</p>
      <div className="grid gap-4 xl:grid-cols-2">{rows.map((r) => <article key={r.agent.id} className="min-w-0 rounded-lg border border-border bg-background p-4" aria-label={`${r.agent.name} KPIs`}>
        <h3 className="text-lg font-semibold">{r.agent.name}</h3>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          {[
            [t({ bn: "মালিকানার লিড (এখন)", en: "Owned leads (now)" }), r.leads.owned],
            [t({ bn: "চলমান কাজ (এখন)", en: "Active assigned (now)" }), r.leads.active],
            [t({ bn: "বন্ধ লিড (এখন)", en: "Closed leads (now)" }), r.leads.closed],
            [t({ bn: "সম্পন্ন মালিকানার কাজ", en: "Completed owned work" }), r.leads.completedOwned],
            [t({ bn: "চলমান হট লিড", en: "Hot leads (active)" }), r.leads.hot],
            [`${t({ bn: "জমা রিপোর্ট", en: "Submitted reports" })} · ${period}`, r.reports.submitted],
            [t({ bn: "কথা হয়েছে (রিপোর্ট)", en: "Connected reports" }), `${r.reports.reportedConnected} (${r.reports.rate}%)`],
            [t({ bn: "রিপোর্টে আলাদা লিড", en: "Unique reported leads" }), r.breakdown.leads],
            [t({ bn: "বর্তমান ফলো-আপ / মেয়াদোত্তীর্ণ", en: "Open / overdue follow-ups" }), `${r.followUps.open} / ${r.followUps.overdue}`],
          ].map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd></div>)}
        </dl>
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{t({ bn: `${r.breakdown.reports}টি রিপোর্ট · ${r.breakdown.leads}টি আলাদা লিড। একই লিডে একাধিক রিপোর্ট থাকতে পারে। ${r.breakdown.stillOwned}টি এখনো মালিকানায়; ${r.breakdown.movedAway}টি এখন অন্যত্র।`, en: `${r.breakdown.reports} reports · ${r.breakdown.leads} unique leads. One lead can have multiple reports. ${r.breakdown.stillOwned} still owned; ${r.breakdown.movedAway} no longer owned.` })}</p>
      </article>)}</div>
    </>}
  </section>;
}