import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import type { ReportResult } from "@/lib/crm-reports";

import { EmptyBlock } from "./EmptyBlock";

const TOOLTIP = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  fontSize: 12,
} as const;

/** Daily activity chart toggling between call activity and pipeline trend lines. */
export function DailyActivityChart({
  report,
  trend,
  onTrendChange,
  hasActivity,
  onReset,
}: {
  report: ReportResult;
  trend: "activity" | "pipeline";
  onTrendChange: (trend: "activity" | "pipeline") => void;
  hasActivity: boolean;
  onReset: () => void;
}) {
  const t = useT();
  const labelInterval = Math.max(0, Math.ceil(report.daily.length / 8) - 1);

  return (
    <section className="card-elevated p-3 sm:p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="size-4 shrink-0 text-primary" /> {t({ bn: "দৈনিক কাজের ছবি", en: "Daily activity" })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {trend === "activity"
              ? t({ bn: "কত কল দেওয়া হয়েছে, কতটিতে কথা হয়েছে", en: "Calls made vs conversations answered" })
              : t({ bn: "নতুন লিড, হোয়াটসঅ্যাপ আর কথার সময়", en: "New leads, WhatsApp touches and talk minutes" })}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant={trend === "activity" ? "secondary" : "ghost"}
            onClick={() => onTrendChange("activity")}
          >
            {t({ bn: "কল", en: "Calls" })}
          </Button>
          <Button
            size="sm"
            variant={trend === "pipeline" ? "secondary" : "ghost"}
            onClick={() => onTrendChange("pipeline")}
          >
            {t({ bn: "পাইপলাইন", en: "Pipeline" })}
          </Button>
        </div>
      </div>

      {!hasActivity ? (
        <EmptyBlock
          title={t({ bn: "এই সময়ে কোনো কাজ নেই", en: "No activity recorded for this period" })}
          hint={t({ bn: "তারিখ বা ফিল্টার বদলে দেখুন।", en: "Adjust the date or filters to view available data." })}
          onReset={onReset}
        />
      ) : (
        <div className="mt-3 h-[240px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {trend === "activity" ? (
              <AreaChart data={report.daily} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rp-dials" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="rp-conn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  interval={labelInterval}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  allowDecimals={false}
                  width={34}
                />
                <Tooltip contentStyle={TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="dials"
                  name={t({ bn: "কল দেওয়া হয়েছে", en: "Calls made" })}
                  stroke="var(--chart-1)"
                  fill="url(#rp-dials)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="connected"
                  name={t({ bn: "কথা হয়েছে", en: "Connected" })}
                  stroke="var(--chart-3)"
                  fill="url(#rp-conn)"
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              <LineChart data={report.daily} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  interval={labelInterval}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  allowDecimals={false}
                  width={34}
                />
                <Tooltip contentStyle={TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="newLeads"
                  name={t({ bn: "নতুন লিড", en: "New leads" })}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="whatsapp"
                  name={t({ bn: "হোয়াটসঅ্যাপ", en: "WhatsApp" })}
                  stroke="var(--chart-4)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="talkMinutes"
                  name={t({ bn: "কথার মিনিট", en: "Talk min" })}
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
