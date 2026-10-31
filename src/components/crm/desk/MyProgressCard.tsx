import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, Inbox, Target } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { useT } from "@/lib/i18n";
import { useSnapshot } from "@/lib/crm-data";
import { dhakaDay } from "@/lib/lead-groups";
import { deskLeadCounts, deskReportCounts } from "@/lib/desk-counts";
import { getDeskWork } from "@/lib/desk-work.functions";
import { getDailyAllocation } from "@/lib/daily-allocation.functions";
import { myProgress } from "@/lib/my-progress";
import { useMyAccount } from "@/lib/session";

function Stat({ icon, label, value, hint, children }: { icon: ReactNode; label: string; value: string; hint: string; children?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {children}
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** One glance at the agent's own day: pending leads, reports submitted, and the 50-lead daily quota. */
export function MyProgressCard() {
  const t = useT();
  const { leads } = useSnapshot();
  const { account } = useMyAccount();
  const readWork = useServerFn(getDeskWork);
  const readAllocation = useServerFn(getDailyAllocation);
  // Same keys as the desk's other cards, so no extra server reads.
  const work = useQuery({ queryKey: ["desk-work-stats"], queryFn: () => readWork(), refetchInterval: 60_000 });
  const allocation = useQuery({
    queryKey: ["daily-new-allocation", "self", null, account?.profile?.id],
    queryFn: () => readAllocation({ data: { surface: "self", adminToken: null } }),
    refetchInterval: 60_000,
    retry: false,
  });

  const p = useMemo(() => {
    const me = work.data?.agentId ?? "";
    const today = dhakaDay(new Date());
    const rc = work.data ? deskReportCounts(work.data.reports, today) : null;
    const lc = me ? deskLeadCounts(leads, me, { from: today, to: today }) : null;
    const a = allocation.data;
    const mine = a?.agents?.find((row: { id?: string; agentId?: string }) => (row.agentId ?? row.id) === me) ?? a?.agents?.[0];
    return myProgress({
      quota: a ? a.quota : null,
      received: mine ? mine.received : a ? 0 : null,
      pendingLeads: lc ? lc.activePending : null,
      reportsToday: rc ? rc.submitted : null,
      connectedToday: rc ? rc.reportedConnected : null,
    });
  }, [leads, work.data, allocation.data]);

  const na = t({ bn: "তথ্য নেই", en: "Not available" });
  const show = (n: number | null) => (n == null ? "—" : String(n));

  return (
    <section aria-labelledby="my-progress-title" className="space-y-3">
      <header>
        <h2 id="my-progress-title" className="text-base font-semibold">{t({ bn: "আমার আজকের অগ্রগতি", en: "My progress today" })}</h2>
        <p className="text-xs text-muted-foreground">{t({ bn: "শুধু আপনার নিজের কাজ · ঢাকা সময়", en: "Only your own work · Dhaka time" })}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<Inbox className="size-4" aria-hidden />}
          label={t({ bn: "বাকি লিড", en: "Pending leads" })}
          value={show(p.pendingLeads)}
          hint={p.pendingLeads == null ? na : t({ bn: "আপনার লিড, এখনো কল/রিপোর্ট হয়নি", en: "Your leads not yet called or reported" })}
        />
        <Stat
          icon={<ClipboardCheck className="size-4" aria-hidden />}
          label={t({ bn: "আজ জমা দেওয়া রিপোর্ট", en: "Reports submitted today" })}
          value={show(p.reportsToday)}
          hint={p.reportsToday == null ? na : t({ bn: `${p.connectedToday ?? 0}টিতে কথা হয়েছে`, en: `${p.connectedToday ?? 0} with a conversation` })}
        />
        <Stat
          icon={<Target className="size-4" aria-hidden />}
          label={t({ bn: "দৈনিক কোটা", en: "Daily quota" })}
          value={p.received == null || p.quota == null ? "—" : `${p.received} / ${p.quota}`}
          hint={p.stillToReceive == null ? (allocation.isError ? t({ bn: "কোটার তথ্য আনা যায়নি", en: "Could not load the quota" }) : na)
            : p.stillToReceive === 0 ? t({ bn: "আজকের সব লিড পেয়েছেন", en: "You've received all of today's leads" })
            : t({ bn: `আরও ${p.stillToReceive}টি লিড আসতে পারে`, en: `${p.stillToReceive} more leads can still arrive` })}
        >
          {p.quotaPct != null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.quotaPct} aria-label={t({ bn: "কোটা পূরণ", en: "Quota filled" })}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.quotaPct}%` }} />
            </div>
          )}
        </Stat>
      </div>
    </section>
  );
}
