import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Smartphone, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminToken } from "@/lib/local-session";
import { listAndroidSyncFailures } from "@/lib/android-sync-failures.functions";
import {
  ITEM_LABEL,
  NEXT_STEP,
  formatDhaka,
  summarizeSyncFailures,
  type SyncFailureEvent,
} from "@/lib/android-sync-failures";

export const Route = createFileRoute("/sync-failures")({
  head: () => ({
    meta: [
      { title: "Android sync failures — Winstone Pulse" },
      { name: "description", content: "HQ/IT read-only summary of agent phone sync failures by error type and agent, with recommended next steps." },
      { property: "og:title", content: "Android sync failures — Winstone Pulse" },
      { property: "og:description", content: "Agent phone sync failures grouped by error type and agent, with Dhaka timestamps." },
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
        icon={<Smartphone className="size-7" />}
        title="ফোন সিঙ্ক সমস্যা · Android sync failures"
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
] as const;
type RangeKey = (typeof RANGES)[number]["value"];

function Board() {
  const listFn = useServerFn(listAndroidSyncFailures);
  const [range, setRange] = useState<RangeKey>("7d");
  const q = useQuery({
    queryKey: ["android-sync-failures", range],
    queryFn: () => {
      const to = new Date();
      const from = new Date(to.getTime() - RANGES.find((r) => r.value === range)!.ms);
      return listFn({ data: { adminToken: getAdminToken(), fromIso: from.toISOString(), toIso: to.toISOString() } });
    },
    staleTime: 30_000,
  });
  const s = useMemo(() => summarizeSyncFailures(q.data?.events ?? []), [q.data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ফোন সিঙ্ক সমস্যা · Android sync failures</h1>
          <p className="text-sm text-muted-foreground">
            Read-only. Failures agent phones (app 2.22+) reported after reconnecting. Times are Asia/Dhaka; raw UTC is on each row.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor="sf-range">
            Time range
            <select id="sf-range" className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
              {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {q.isLoading ? (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading sync failures…</div>
      ) : q.error ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Could not load sync failures</p>
            <p className="text-muted-foreground">{q.error instanceof Error ? q.error.message : "Unknown error"}</p>
          </div>
        </div>
      ) : (
        <>
          {q.data?.capped && (
            <p role="status" className="rounded-lg border border-border bg-muted/50 p-3 text-sm">Showing the newest 3,000 reports only. Pick a shorter range to see everything.</p>
          )}
          <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi label="Failures" value={s.failures} />
            <Kpi label="Need a person (permanent)" value={s.permanent} danger={s.permanent > 0} />
            <Kpi label="Agents affected" value={s.agentsAffected} />
          </section>

          {!s.failures ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No sync failures reported in this time range. Phones on app 2.21 or older do not report failures.
            </p>
          ) : (
            <>
              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">By error type</h2>
                <ul className="space-y-3">
                  {s.kinds.map((k) => (
                    <li key={k.kind} className="border-t border-border pt-3 first:border-0 first:pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{k.label}</span>
                        <Badge variant={k.permanent ? "destructive" : "secondary"}>{k.permanent ? "Needs action" : "Retries automatically"}</Badge>
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{k.failures} failures · {k.agents} agent{k.agents === 1 ? "" : "s"} · last {formatDhaka(k.lastAtUtc)}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground">Next step:</span> {k.step}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">By agent</h2>
                <ul className="space-y-2 md:hidden">
                  {s.agents.map((a) => (
                    <li key={a.agentId ?? "unknown"} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium">{a.agentName}</p>
                      <p className="text-muted-foreground">{a.failures} failures ({a.permanent} need action) · app {a.appVersion}</p>
                      <p className="text-muted-foreground">Most common: {NEXT_STEP[a.topKind].label} · last {formatDhaka(a.lastAtUtc)}</p>
                      <p className="mt-1">{a.step}</p>
                    </li>
                  ))}
                </ul>
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr><th className="py-1 pr-3 font-medium">Agent</th><th className="py-1 pr-3 text-right font-medium">Failures</th><th className="py-1 pr-3 text-right font-medium">Need action</th><th className="py-1 pr-3 font-medium">Most common</th><th className="py-1 pr-3 font-medium">Last (Dhaka)</th><th className="py-1 pr-3 font-medium">App</th><th className="py-1 font-medium">Next step</th></tr>
                    </thead>
                    <tbody>
                      {s.agents.map((a) => (
                        <tr key={a.agentId ?? "unknown"} className="border-t border-border align-top">
                          <td className="py-1.5 pr-3 font-medium">{a.agentName}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{a.failures}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{a.permanent}</td>
                          <td className="py-1.5 pr-3">{NEXT_STEP[a.topKind].label}</td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{formatDhaka(a.lastAtUtc)}</td>
                          <td className="py-1.5 pr-3">{a.appVersion}</td>
                          <td className="py-1.5 text-muted-foreground">{a.step}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">Latest reports ({s.latest.length})</h2>
                <ul className="space-y-2">
                  {s.latest.map((e) => <EventRow key={e.id} e={e} />)}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function EventRow({ e }: { e: SyncFailureEvent }) {
  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{formatDhaka(e.lastAtUtc)}</span>
        <span>{e.agentName}</span>
        <Badge variant={e.permanent ? "destructive" : "secondary"}>{NEXT_STEP[e.errorKind].label}</Badge>
      </div>
      <p className="mt-1 text-muted-foreground">
        {ITEM_LABEL[e.itemKind]} · HTTP {e.httpStatus ?? "Not captured"} · {e.attempts} attempt{e.attempts === 1 ? "" : "s"}
        {e.count > 1 ? ` · seen ${e.count}×` : ""} · call ref {e.callRef ?? "Not captured"} · app {e.appVersion}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        UTC last {e.lastAtUtc}{e.firstAtUtc ? ` · first ${e.firstAtUtc}` : ""} · received {e.receivedAtUtc}
      </p>
    </li>
  );
}

function Kpi({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
