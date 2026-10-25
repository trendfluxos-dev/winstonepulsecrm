import type { ReportResult } from "@/lib/crm-reports";
import { useT } from "@/lib/i18n";

function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Six headline KPI cards summarising the report's totals for the selected range. */
export function ReportsKpiStrip({ report }: { report: ReportResult }) {
  const t = useT();
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Kpi
        label={t({ bn: "কল দেওয়া হয়েছে", en: "Calls made" })}
        value={report.totals.dials}
        hint={`${report.totals.activeAgents} ${t({ bn: "জন এজেন্ট", en: "agents" })}`}
      />
      <Kpi
        label={t({ bn: "কথা হয়েছে", en: "Connected" })}
        value={report.totals.connected}
        hint={t({ bn: "কল গেছে, কথাও হয়েছে", en: "answered conversations" })}
      />
      <Kpi
        label={t({ bn: "কথা হওয়ার হার", en: "Connect rate" })}
        value={report.totals.connected > 0 ? `${report.totals.connectRate.toFixed(1)}%` : 0}
        hint={t({ bn: "প্রতি ১০০ কলে কতটিতে কথা", en: "of all calls made" })}
      />
      <Kpi
        label={t({ bn: "কথার সময়", en: "Talk time" })}
        value={report.totals.talkMinutes > 0 ? formatMinutes(report.totals.talkMinutes) : 0}
        hint={t({ bn: "সব কল মিলিয়ে", en: "across every call" })}
      />
      <Kpi
        label={t({ bn: "নতুন লিড", en: "New leads" })}
        value={report.totals.newLeads}
        hint={t({ bn: "এই সময়ে যোগ হয়েছে", en: "created in this range" })}
      />
      <Kpi
        label={t({ bn: "বুকিং হয়েছে", en: "Deals won" })}
        value={report.totals.dealsWon}
        hint={t({ bn: "শেষ হওয়া লিড", en: "closed leads" })}
      />
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  const t = useT();
  const empty = value === 0 || value === "0";
  return (
    <div className="card-elevated p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="tabular mt-1 text-xl font-bold tracking-tight sm:text-2xl">
        {empty ? "0" : value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {empty ? t({ bn: "এই সময়ে কোনো কাজ নেই", en: "No activity yet" }) : hint}
      </p>
    </div>
  );
}
