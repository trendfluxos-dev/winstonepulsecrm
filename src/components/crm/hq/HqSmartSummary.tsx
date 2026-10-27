import { commandCenterFeedQuery } from "@/lib/crm-data";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Inbox, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CallRecording, Lead, Profile, WhatsappMessage } from "@/lib/crm-data";
import { getCommandCenterFeed } from "@/lib/command-center.functions";
import { computeHqSmartSummary } from "@/lib/hq-smart-summary";
import { DEFAULT_DAILY_QUOTA } from "@/lib/lead-quota";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

type Props = { profiles: Profile[]; leads: Lead[]; calls: CallRecording[]; messages: WhatsappMessage[]; loading?: boolean; onSelectAgent?: (id: string) => void };

export function HqSmartSummary({ profiles, leads, calls, loading, onSelectAgent }: Props) {
  const t = useT();
  const adminToken = useAdminToken();
  const fetchFeed = useServerFn(getCommandCenterFeed);
  // Shares the exact query/cache with SalesCommandCenter, not a second reader.
  const queryClient = useQueryClient();
  const feed = useQuery(commandCenterFeedQuery(queryClient, adminToken, fetchFeed));
  const summary = useMemo(() => computeHqSmartSummary({
    agents: profiles.filter(p => (p.role === "agent" || p.role === "team_leader") && p.is_active && p.approval_status === "approved").map(p => ({ id: p.id, name: p.name })),
    leads, calls, reports: feed.data?.reports ?? [], followUps: feed.data?.followUps ?? [], now: new Date(), dailyLeadQuota: DEFAULT_DAILY_QUOTA,
  }), [profiles, leads, calls, feed.data]);
  const title = t({ bn: "আজকের কাজের সারাংশ", en: "Today's work summary" });
  if (loading || feed.isPending) return <section aria-label={title}><h2 className="mb-3 font-semibold">{title}</h2><Skeleton className="h-40 w-full" /></section>;
  if (feed.isError) return <section aria-label={title} className="space-y-2"><h2 className="font-semibold">{title}</h2><p className="text-sm text-warning">{t({ bn: "তথ্য আনা যায়নি — সংখ্যাগুলো এখন নিশ্চিত নয়।", en: "Data could not load — the numbers are not confirmed yet." })}</p><Button variant="outline" size="sm" onClick={() => void feed.refetch()}>{t({ bn: "আবার চেষ্টা করুন", en: "Try again" })}</Button></section>;
  const rows = [...summary.noEvidence, ...summary.behind];
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{t({ bn: "ঢাকা সময় অনুযায়ী গোনা — জমা দেওয়া রিপোর্ট আর কলের হিসাব থেকে।", en: "Counted in Dhaka time — from submitted reports and call records." })}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="min-w-0 rounded-lg border border-border bg-background p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 shrink-0 text-warning" />{t({ bn: "আজকের কলের প্রমাণ", en: "Today's call evidence" })}</h3>
          {rows.length === 0 ? <p className="text-xs text-muted-foreground">{t({ bn: "সব সক্রিয় এজেন্টের কলের হিসাব পাওয়া গেছে।", en: "Every active agent has call records." })}</p> : <ul className="space-y-2">
            {rows.map(row => <li key={row.id}><Button variant="ghost" onClick={() => onSelectAgent?.(row.id)} className="h-auto w-full min-w-0 flex-col items-start gap-1 whitespace-normal px-2 py-2 text-left text-xs"><span className="break-words font-medium">{row.name}</span><span className="break-words text-muted-foreground">{row.calls === 0 ? t({ bn: "আজ কলের প্রমাণ নেই", en: "No call proof today yet" }) : t({ bn: `${row.connected} জনে কথা / ${row.calls}টি কল`, en: `${row.connected} connected / ${row.calls} calls` })}</span></Button></li>)}
          </ul>}
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-background p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Inbox className="size-4 shrink-0 text-accent-foreground" />{t({ bn: "যে লিডগুলো এখনো কাজ হয়নি", en: "Leads not yet worked" })}</h3>
          <p className="text-2xl font-bold tabular-nums">{summary.pendingCount}</p>
          <p className="mb-3 text-xs text-muted-foreground">{t({ bn: "যেসব লিডে কোনো কল বা রিপোর্টের প্রমাণ নেই — সব দিন মিলিয়ে। এটা আজকের নতুন লিড নয়।", en: "Leads with no call or report proof — all dates combined. Not today's new leads." })}</p>
          <ul className="space-y-2">{summary.pendingByAgent.slice(0, 4).map(row => <li key={row.id} className="flex items-start justify-between gap-3 text-xs"><span className="min-w-0 break-words text-muted-foreground">{row.name}</span><span className="shrink-0 font-semibold tabular-nums">{row.count}</span></li>)}</ul>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-background p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><PhoneCall className="size-4 shrink-0 text-primary" />{t({ bn: "আজকের সংরক্ষিত ফলাফল", en: "Today's saved results" })}</h3>
          <dl className="space-y-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t({ bn: "কথা হয়েছে যত কলে", en: "Connected calls" })}</dt><dd className="font-semibold tabular-nums">{summary.connectedToday}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t({ bn: "বুকিং হওয়ার ইঙ্গিত", en: "Booking signals" })}</dt><dd className="font-semibold tabular-nums">{summary.bookingsToday}</dd></div></dl>
        </div>
      </div>
    </section>
  );
}
