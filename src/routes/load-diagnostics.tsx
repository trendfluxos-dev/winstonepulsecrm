import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Loader2, MonitorX, RefreshCw, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminToken } from "@/lib/local-session";
import { listLoadDiagnostics } from "@/lib/load-diagnostics.functions";
import {
  FALLBACK_SHOWN_MESSAGE,
  IMPORTING_MODULE_MESSAGE,
  MESSAGE_CLASS_LABEL,
  NOT_CAPTURED,
  OUTCOME_LABEL,
  UNKNOWN,
  applyFilters,
  browserLabel,
  eventsToCsv,
  formatDhaka,
  osLabel,
  summarize,
  type LoadEvent,
  type LoadFilters,
  type RecoveryOutcome,
} from "@/lib/load-diagnostics";

export const Route = createFileRoute("/load-diagnostics")({
  head: () => ({
    meta: [
      { title: "Page-load diagnostics — Winstone Pulse" },
      { name: "description", content: "HQ/IT read-only summary of module-load failures, missing startup files and automatic recovery outcomes." },
      { property: "og:title", content: "Page-load diagnostics — Winstone Pulse" },
      { property: "og:description", content: "Module-load failures, missing files and recovery outcomes by browser, route and time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <RoleGate
        allow={["authority"]}
        icon={<MonitorX className="size-7" />}
        title="পেজ লোড ডায়াগনস্টিকস · Page-load diagnostics"
        description="শুধু HQ / IT — মাস্টার পিন দিয়ে খুলুন।"
      >
        <Board />
      </RoleGate>
    </AppShell>
  );
}

const RANGES = [
  { value: "24h", label: "Last 24 hours", ms: 86_400_000 },
  { value: "7d", label: "Last 7 days", ms: 7 * 86_400_000 },
  { value: "30d", label: "Last 30 days", ms: 30 * 86_400_000 },
  { value: "90d", label: "Last 90 days", ms: 90 * 86_400_000 },
] as const;
type RangeKey = (typeof RANGES)[number]["value"];

const isFallback = (o: RecoveryOutcome) => o === "fallback-shown" || o === "server-offline" || o === "assets-waiting";

function Board() {
  const listFn = useServerFn(listLoadDiagnostics);
  const [range, setRange] = useState<RangeKey>("7d");
  const [filters, setFilters] = useState<LoadFilters>({ moduleOnly: true });
  const [open, setOpen] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["load-diagnostics", range],
    queryFn: () => {
      const ms = RANGES.find((r) => r.value === range)!.ms;
      const to = new Date();
      const from = new Date(to.getTime() - ms);
      return listFn({ data: { adminToken: getAdminToken(), fromIso: from.toISOString(), toIso: to.toISOString() } });
    },
    staleTime: 30_000,
  });

  const all = q.data?.events ?? [];
  const shown = useMemo(() => applyFilters(all, filters), [all, filters]);
  const s = useMemo(() => summarize(shown, range === "24h" ? "hour" : "day"), [shown, range]);

  const options = useMemo(() => {
    const uniq = (f: (e: LoadEvent) => string) => [...new Set(all.map(f))].sort();
    return {
      browser: uniq(browserLabel),
      os: uniq(osLabel),
      device: uniq((e) => e.device),
      route: uniq((e) => e.route),
      kind: uniq((e) => e.kind),
      outcome: [...new Set(all.map((e) => e.outcome))],
    };
  }, [all]);

  const set = (k: keyof LoadFilters, v: string) => setFilters((f) => ({ ...f, [k]: v || undefined }));

  const exportCsv = () => {
    const blob = new Blob(["\ufeff" + eventsToCsv(shown)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `page-load-diagnostics-${range}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">পেজ লোড ডায়াগনস্টিকস · Page-load diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            Read-only. Uses error reports browsers already sent to the CRM. Times are Asia/Dhaka; raw UTC is in each event's details.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!shown.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      <fieldset className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-1 text-xs font-medium text-muted-foreground">Filters</legend>
        <Picker id="ld-range" label="Time range" value={range} onChange={(v) => setRange(v as RangeKey)} options={RANGES.map((r) => [r.value, r.label])} />
        <Picker id="ld-browser" label="Browser + version" value={filters.browser ?? ""} onChange={(v) => set("browser", v)} options={[["", "All browsers"], ...options.browser.map((b) => [b, b] as [string, string])]} />
        <Picker id="ld-os" label="Operating system" value={filters.os ?? ""} onChange={(v) => set("os", v)} options={[["", "All systems"], ...options.os.map((b) => [b, b] as [string, string])]} />
        <Picker id="ld-device" label="Device" value={filters.device ?? ""} onChange={(v) => set("device", v)} options={[["", "All devices"], ...options.device.map((b) => [b, b] as [string, string])]} />
        <Picker id="ld-route" label="Page (route)" value={filters.route ?? ""} onChange={(v) => set("route", v)} options={[["", "All pages"], ...options.route.map((b) => [b, b] as [string, string])]} />
        <Picker id="ld-kind" label="Error type" value={filters.kind ?? ""} onChange={(v) => set("kind", v)} options={[["", "All types"], ...options.kind.map((b) => [b, b] as [string, string])]} />
        <Picker id="ld-outcome" label="Recovery outcome" value={filters.outcome ?? ""} onChange={(v) => set("outcome", v)} options={[["", "All outcomes"], ...options.outcome.map((o) => [o, OUTCOME_LABEL[o]] as [string, string])]} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={!!filters.moduleOnly} onChange={(e) => setFilters((f) => ({ ...f, moduleOnly: e.target.checked }))} />
          Module-load &amp; recovery events only
        </label>
      </fieldset>

      {q.isLoading ? (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading diagnostics…</div>
      ) : q.error ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Could not load diagnostics</p>
            <p className="text-muted-foreground">{q.error instanceof Error ? q.error.message : "Unknown error"}</p>
          </div>
        </div>
      ) : (
        <>
          {q.data?.capped && (
            <p role="status" className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              Showing the newest 5,000 events only. Pick a shorter time range to see everything.
            </p>
          )}

          <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
            <Kpi label="Events" value={s.total} />
            <Kpi label="Module-load events" value={s.moduleLoad} />
            <Kpi label={`“${IMPORTING_MODULE_MESSAGE}”`} value={s.importingModuleScript} danger={s.importingModuleScript > 0} />
            <Kpi label="Fallback shown" value={s.fallbackShown} danger={s.fallbackShown > 0} hint={`Reported to hosting as “${FALLBACK_SHOWN_MESSAGE}”`} />
            <Kpi label="Recovered" value={s.recovered} />
            <Kpi label="Retry / reload attempts" value={s.reloadAttempts} />
            <Kpi label="Server offline" value={s.serverOffline} />
            <Kpi label="Asset check still missing" value={s.assetsWaiting} />
            <Kpi label="Missing asset URLs" value={s.missingAssetUrls} />
            <Kpi label="Unknown browser" value={s.unknownBrowser} />
          </section>

          {!shown.length ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No events match these filters in this time range.
            </p>
          ) : (
            <>
              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">Trend ({range === "24h" ? "per hour" : "per day"}, Dhaka)</h2>
                <Trend data={s.trend} />
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-border bg-card p-4">
                  <h2 className="mb-3 text-sm font-semibold">Recovery outcomes</h2>
                  <ul className="space-y-1 text-sm">
                    {s.byOutcome.map((o) => (
                      <li key={o.outcome} className="flex justify-between gap-3">
                        <span>{o.label}</span><span className="tabular-nums font-medium">{o.count}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">Attempt numbers per tab are kept only in that tab, so they are not recorded here; each reload report counts once.</p>
                </section>
                <section className="rounded-xl border border-border bg-card p-4">
                  <h2 className="mb-3 text-sm font-semibold">Message class</h2>
                  <ul className="space-y-1 text-sm">
                    {s.byMessageClass.map((c) => (
                      <li key={c.cls} className="flex justify-between gap-3">
                        <span className="break-words">{c.label}</span><span className="tabular-nums font-medium">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">Browser breakdown</h2>
                <div className="table-scroll">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr><th className="py-1 pr-3 font-medium">Browser</th><th className="py-1 pr-3 font-medium">System</th><th className="py-1 pr-3 font-medium">Device</th><th className="py-1 pr-3 text-right font-medium">Events</th><th className="py-1 pr-3 text-right font-medium">Module-load</th><th className="py-1 text-right font-medium">Fallback</th></tr>
                    </thead>
                    <tbody>
                      {s.byBrowser.map((b) => (
                        <tr key={`${b.browser}|${b.os}|${b.device}`} className="border-t border-border">
                          <td className="py-1.5 pr-3">{b.browser}</td><td className="py-1.5 pr-3">{b.os}</td><td className="py-1.5 pr-3">{b.device}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{b.count}</td><td className="py-1.5 pr-3 text-right tabular-nums">{b.moduleLoad}</td><td className="py-1.5 text-right tabular-nums">{b.fallback}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">Missing or failed asset URLs</h2>
                {s.missingAssets.length ? (
                  <ul className="space-y-2 text-sm">
                    {s.missingAssets.map((a) => (
                      <li key={`${a.url}|${a.status}`} className="flex flex-col gap-1 border-t border-border pt-2 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                        <code className="break-all text-xs">{a.url}</code>
                        <span className="shrink-0 text-xs text-muted-foreground">{a.status} · {a.count}× · last {formatDhaka(a.lastSeenUtc)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No asset URL was captured for these events.</p>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">Latest events ({Math.min(shown.length, 200)} of {shown.length})</h2>
                <ul className="space-y-2 md:hidden">
                  {shown.slice(0, 200).map((e) => (
                    <li key={e.id} className="rounded-lg border border-border p-3 text-sm">
                      <button type="button" className="flex w-full items-start justify-between gap-2 text-left" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                        <span>
                          <span className="block font-medium">{formatDhaka(e.occurredAtUtc)}</span>
                          <span className="block text-muted-foreground">{e.route} · {browserLabel(e)}</span>
                          <OutcomeBadge o={e.outcome} />
                        </span>
                        {open === e.id ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                      </button>
                      {open === e.id && <Details e={e} />}
                    </li>
                  ))}
                </ul>
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr><th className="w-8" aria-label="Expand" /><th className="py-1 pr-3 font-medium">Time (Dhaka)</th><th className="py-1 pr-3 font-medium">Route</th><th className="py-1 pr-3 font-medium">Error type</th><th className="py-1 pr-3 font-medium">Message</th><th className="py-1 pr-3 font-medium">Browser</th><th className="py-1 font-medium">Outcome</th></tr>
                    </thead>
                    <tbody>
                      {shown.slice(0, 200).map((e) => (
                        <EventRow key={e.id} e={e} open={open === e.id} toggle={() => setOpen(open === e.id ? null : e.id)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {q.data && <p className="text-xs text-muted-foreground">Read at {formatDhaka(q.data.readAtUtc)} Dhaka.</p>}
        </>
      )}
    </div>
  );
}

function Picker({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
        {options.map(([v, l]) => <option key={v || "all"} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Kpi({ label, value, danger, hint }: { label: string; value: number; danger?: boolean; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}

function OutcomeBadge({ o }: { o: RecoveryOutcome }) {
  return <Badge variant={isFallback(o) ? "destructive" : o === "recovered" ? "secondary" : "outline"} className="mt-1">{OUTCOME_LABEL[o]}</Badge>;
}

function Trend({ data }: { data: { bucket: string; total: number; moduleLoad: number; fallback: number; recovered: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <ol className="flex h-36 items-end gap-1 overflow-x-auto" aria-label="Events over time">
      {data.map((d) => (
        <li key={d.bucket} className="flex h-full min-w-[18px] flex-1 flex-col items-center justify-end gap-1" aria-label={`${d.bucket}: ${d.total} events, ${d.fallback} fallback, ${d.recovered} recovered`} title={`${d.bucket} · ${d.total} events · ${d.fallback} fallback · ${d.recovered} recovered`}>
          <div className="flex w-full flex-col justify-end overflow-hidden rounded-sm bg-muted" style={{ height: `${(d.total / max) * 100}%` }}>
            <div className="w-full bg-destructive" style={{ height: `${(d.fallback / Math.max(1, d.total)) * 100}%` }} />
            <div className="w-full bg-primary/70" style={{ height: `${((d.moduleLoad - d.fallback) / Math.max(1, d.total)) * 100}%` }} />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">{d.bucket.slice(5)}</span>
        </li>
      ))}
    </ol>
  );
}

function EventRow({ e, open, toggle }: { e: LoadEvent; open: boolean; toggle: () => void }) {
  return (
    <>
      <tr className="border-t border-border align-top">
        <td className="py-1.5">
          <button type="button" onClick={toggle} aria-expanded={open} aria-label={open ? "Hide details" : "Show details"} className="rounded p-1 hover:bg-muted">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </td>
        <td className="py-1.5 pr-3 whitespace-nowrap">{formatDhaka(e.occurredAtUtc)}</td>
        <td className="py-1.5 pr-3 break-all">{e.route}</td>
        <td className="py-1.5 pr-3">{e.kind}</td>
        <td className="py-1.5 pr-3 max-w-[320px] break-words">{MESSAGE_CLASS_LABEL[e.messageClass]}</td>
        <td className="py-1.5 pr-3">{browserLabel(e)}</td>
        <td className="py-1.5"><OutcomeBadge o={e.outcome} /></td>
      </tr>
      {open && (
        <tr><td /><td colSpan={6} className="pb-3"><Details e={e} /></td></tr>
      )}
    </>
  );
}

function Details({ e }: { e: LoadEvent }) {
  const rows: [string, string][] = [
    ["Time (Asia/Dhaka)", formatDhaka(e.occurredAtUtc)],
    ["Time (UTC, raw)", e.occurredAtUtc],
    ["Route", e.route],
    ["Source", e.source],
    ["Error type", e.kind],
    ["Message class", MESSAGE_CLASS_LABEL[e.messageClass]],
    ["Message (redacted)", e.message],
    ["Asset URL", e.assetUrl ?? NOT_CAPTURED],
    ["Asset HTTP status / fetch outcome", e.assetStatus ?? NOT_CAPTURED],
    ["File", e.filename ?? NOT_CAPTURED],
    ["Line", e.line != null ? String(e.line) : NOT_CAPTURED],
    ["Column", e.column != null ? String(e.column) : NOT_CAPTURED],
    ["Stack", NOT_CAPTURED],
    ["Recovery outcome", OUTCOME_LABEL[e.outcome]],
    ["Attempt number", NOT_CAPTURED],
    ["Browser", browserLabel(e)],
    ["Operating system", osLabel(e)],
    ["Device", e.device || UNKNOWN],
  ];
  return (
    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-[200px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-muted-foreground">{k}</dt>
          <dd className="break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
