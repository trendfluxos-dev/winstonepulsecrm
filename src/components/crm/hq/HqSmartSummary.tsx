import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const feed = useQuery({ queryKey: ["command-center-feed", adminToken], queryFn: () => fetchFeed({ data: { adminToken } }), refetchInterval: 30_000 });
  const summary = useMemo(() => computeHqSmartSummary({
    agents: profiles.filter(p => (p.role === "agent" || p.role === "team_leader") && p.is_active && p.approval_status === "approved").map(p => ({ id: p.id, name: p.name })),
    leads, calls, reports: feed.data?.reports ?? [], followUps: feed.data?.followUps ?? [], now: new Date(), dailyLeadQuota: DEFAULT_DAILY_QUOTA,
  }), [profiles, leads, calls, feed.data]);
  const title = t({ bn: "আজকের স্মার্ট সারসংক্ষেপ", en: "Today's work summary" });
  if (loading || feed.isPending) return <section aria-label={title}><h2 className="mb-3 font-semibold">{title}</h2><Skeleton className="h-40 w-full" /></section>;
  if (feed.isError) return <section aria-label={title} className="space-y-2"><h2 className="font-semibold">{title}</h2><p className="text-sm text-warning">{t({ bn: "রিপোর্ট পড়া যায়নি — কাজের সংখ্যা এখন নিশ্চিত নয়।", en: "Reports unavailable — work counts cannot be confirmed." })}</p><Button variant="outline" size="sm" onClick={() => void feed.refetch()}>{t({ bn: "আবার যাচাই", en: "Retry" })}</Button></section>;
  const rows = [...summary.noEvidence, ...summary.behind];
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{t({ bn: "ঢাকা সময় · জমা রিপোর্ট ও কল রেকর্ড · ফোনের সিঙ্ক সম্পূর্ণ কি না যাচাই হয়নি", en: "Dhaka time · submitted reports and call records · phone sync completeness unverified" })}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="min-w-0 rounded-lg border border-border bg-background p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 shrink-0 text-warning" />{t({ bn: "আজকের কলের প্রমাণ", en: "Today's call evidence" })}</h3>
          {rows.length === 0 ? <p className="text-xs text-muted-foreground">{t({ bn: "সক্রিয় এজেন্টদের কলের রেকর্ড আছে।", en: "Active agents have recorded call activity." })}</p> : <ul className="space-y-2">
            {rows.map(row => <li key={row.id}><Button variant="ghost" onClick={() => onSelectAgent?.(row.id)} className="h-auto w-full min-w-0 flex-col items-start gap-1 whitespace-normal px-2 py-2 text-left text-xs"><span className="break-words font-medium">{row.name}</span><span className="break-words text-muted-foreground">{row.calls === 0 ? t({ bn: "CRM-এ আজ কলের প্রমাণ নেই; সিঙ্ক যাচাই বাকি", en: "No call evidence in CRM today; sync unverified" }) : t({ bn: `${row.connected} সংযুক্ত / ${row.calls} রেকর্ডকৃত কল`, en: `${row.connected} connected / ${row.calls} recorded calls` })}</span></Button></li>)}
          </ul>}
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-background p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Inbox className="size-4 shrink-0 text-accent-foreground" />{t({ bn: "কলের প্রমাণবিহীন বাকি লিড", en: "Pending leads without call evidence" })}</h3>
          <p className="text-2xl font-bold tabular-nums">{summary.pendingCount}</p>
          <p className="mb-3 text-xs text-muted-foreground">{t({ bn: "সক্রিয় এজেন্টের সব দিনের বাকি লিড; সংরক্ষিত রিপোর্ট, কল বা কলচেষ্টার প্রমাণ নেই। আজকের নতুন বণ্টন নয়।", en: "All-date pending leads for active agents with no saved report, call or attempt evidence. Not today's new allocation." })}</p>
          <ul className="space-y-2">{summary.pendingByAgent.slice(0, 4).map(row => <li key={row.id} className="flex items-start justify-between gap-3 text-xs"><span className="min-w-0 break-words text-muted-foreground">{row.name}</span><span className="shrink-0 font-semibold tabular-nums">{row.count}</span></li>)}</ul>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-background p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><PhoneCall className="size-4 shrink-0 text-primary" />{t({ bn: "আজকের সংরক্ষিত ফলাফল", en: "Today's saved results" })}</h3>
          <dl className="space-y-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t({ bn: "সংযুক্ত কল", en: "Connected calls" })}</dt><dd className="font-semibold tabular-nums">{summary.connectedToday}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t({ bn: "রিপোর্টে বুকিং সিগন্যাল", en: "Reported booking signals" })}</dt><dd className="font-semibold tabular-nums">{summary.bookingsToday}</dd></div></dl>
        </div>
      </div>
    </section>
  );
}
