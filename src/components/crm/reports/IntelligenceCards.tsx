import { Sparkles } from "lucide-react";

import type { ReportFilters, ReportResult } from "@/lib/crm-reports";
import { useT } from "@/lib/i18n";

import { EmptyBlock } from "./EmptyBlock";

/** Lead funnel, source mix and call sentiment breakdown cards — one card answers one question. */
export function IntelligenceCards({ report }: { report: ReportResult }) {
  const t = useT();
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <BreakdownCard
        title={t({ bn: "লিড কোথায় আছে", en: "Lead funnel" })}
        subtitle={t({ bn: "নতুন লিড থেকে বুকিং পর্যন্ত", en: "From new leads to deals" })}
        rows={report.statusMix}
        emptyHint={t({ bn: "এই সময়ে লিডে কোনো কাজ নেই। তারিখ বা ফিল্টার বদলে দেখুন।", en: "No lead activity for this period. Adjust the date or filters." })}
      />
      <BreakdownCard
        title={t({ bn: "লিড কোথা থেকে আসছে", en: "Lead source mix" })}
        subtitle={t({ bn: "কোন পথ থেকে লিড এসেছে", en: "Where the leads come from" })}
        rows={report.sourceMix}
        emptyHint={t({ bn: "এই সময়ে সোর্স-যুক্ত লিড নেই।", en: "No sourced leads in this range." })}
      />
      <BreakdownCard
        title={t({ bn: "কথার ধরন", en: "Call sentiment" })}
        subtitle={t({ bn: "AI কীভাবে কথাগুলো পড়েছে", en: "AI analysed conversations" })}
        rows={report.sentimentMix}
        emptyHint={t({ bn: "এই সময়ে AI-বিশ্লেষিত কল নেই।", en: "No AI-analysed calls in this range." })}
      />
    </section>
  );
}

function BreakdownCard({
  title,
  subtitle,
  rows,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  rows: { key: string; label: string; value: number }[];
  emptyHint: string;
}) {
  const t = useT();
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <div className="card-elevated flex flex-col p-3 sm:p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      {total === 0 ? (
        <EmptyBlock
          title={t({ bn: "এই সময়ে কোনো তথ্য নেই", en: "No data for this period" })}
          hint={emptyHint}
          compact
        />
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
            return (
              <li key={r.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{r.label}</span>
                  <span className="tabular shrink-0 font-semibold">
                    {r.value}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Plain-language summary of the numbers already on screen — nothing invented. */
function brief(report: ReportResult): { bn: string; en: string }[] {
  const t0 = report.totals;
  if (t0.dials === 0 && t0.newLeads === 0) {
    return [
      {
        bn: "এই সময়ে কোনো কাজ হয়নি, তাই সারাংশ নেই।",
        en: "No activity in this period yet, so there is nothing to summarise.",
      },
    ];
  }
  const lines: { bn: string; en: string }[] = [];
  lines.push({
    bn: `${t0.dials}টি কলের মধ্যে ${t0.connected}টিতে কথা হয়েছে (${t0.connectRate.toFixed(1)}%)।`,
    en: `${t0.dials} calls produced ${t0.connected} connected conversations (${t0.connectRate.toFixed(1)}% connect rate).`,
  });
  if (t0.talkMinutes > 0) {
    lines.push({
      bn: `${formatMinutes(t0.talkMinutes)} কথার সময়, ${t0.activeAgents} জন এজেন্ট মিলিয়ে।`,
      en: `${formatMinutes(t0.talkMinutes)} of talk time across ${t0.activeAgents} agents.`,
    });
  }
  lines.push({
    bn: `নতুন লিড ${t0.newLeads}টি, বুকিং ${t0.dealsWon}টি।`,
    en: `${t0.newLeads} new leads created and ${t0.dealsWon} deals won in this range.`,
  });
  const top = [...report.rows].sort((a, b) => b.dials - a.dials)[0];
  if (top && top.dials > 0) {
    const share = t0.dials > 0 ? Math.round((top.dials / t0.dials) * 100) : 0;
    lines.push({
      bn: `সবচেয়ে বেশি কল ${top.agent} — ${top.dials}টি, মোট কাজের ${share}%।`,
      en: `${top.agent} handled ${top.dials} calls — ${share}% of all activity in scope.`,
    });
  }
  if (t0.whatsapp > 0) {
    lines.push({
      bn: `কলের পাশাপাশি ${t0.whatsapp}টি হোয়াটসঅ্যাপ মেসেজ লেখা হয়েছে।`,
      en: `${t0.whatsapp} WhatsApp touches were logged alongside calls.`,
    });
  }
  return lines;
}

function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** AI-style performance brief derived only from the numbers already shown above. */
export function AiPerformanceBrief({
  report,
  filters,
}: {
  report: ReportResult;
  filters: ReportFilters;
}) {
  const t = useT();
  return (
    <section className="card-elevated p-3 sm:p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="size-4 shrink-0 text-primary" /> {t({ bn: "সহজ সারাংশ", en: "Performance brief" })}
      </h2>
      <p className="text-xs text-muted-foreground">
        {filters.from} → {filters.to} · {t({ bn: "উপরের হিসাব থেকেই", en: "from the data in scope" })}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {brief(report).map((line) => (
          <li key={line.en} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="text-muted-foreground">{t(line)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
