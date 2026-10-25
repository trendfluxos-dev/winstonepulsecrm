import type { ReactNode } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { toCsv, downloadCsv, type ReportResult } from "@/lib/crm-reports";

import { EmptyBlock } from "./EmptyBlock";

function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Per-agent activity, connection and conversion scorecard table with CSV export. */
export function AgentPerformanceTable({
  report,
  stamp,
  onReset,
}: {
  report: ReportResult;
  stamp: string;
  onReset: () => void;
}) {
  const t = useT();
  return (
    <section className="card-elevated p-3 sm:p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {t({ bn: "এজেন্টদের কাজের হিসাব", en: "Agent performance" })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t({ bn: "কে কত কল দিয়েছে, কতটিতে কথা হয়েছে, কতটি বুকিং", en: "Activity, connection and conversion overview" })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() =>
            downloadCsv(
              `winstone-agent-scorecard_${stamp}.csv`,
              toCsv(
                [
                  "Agent",
                  "Employee ID",
                  "Dials",
                  "Connected",
                  "Connect %",
                  "Talk minutes",
                  "WhatsApp",
                  "Assigned",
                  "Deals won",
                  "Conversion %",
                ],
                report.rows.map((r) => [
                  r.agent,
                  r.employeeId,
                  r.dials,
                  r.connected,
                  r.connectRate.toFixed(1),
                  r.talkMinutes,
                  r.whatsapp,
                  r.assigned,
                  r.dealsWon,
                  r.conversionRate.toFixed(1),
                ]),
              ),
            )
          }
        >
          <Download className="size-4" /> {t({ bn: "ডাউনলোড", en: "Scorecards" })}
        </Button>
      </div>

      {report.rows.length === 0 ? (
        <EmptyBlock
          title={t({ bn: "এই ফিল্টারে কোনো এজেন্ট নেই", en: "No agents match these filters" })}
          hint={t({ bn: "তারিখ বাড়িয়ে দিন বা এজেন্ট ফিল্টার সরান।", en: "Widen the date range or clear the agent filter." })}
          onReset={onReset}
        />
      ) : (
        <>
        <ul className="mt-3 space-y-2 md:hidden">
          {report.rows.map((r) => (
            <li key={r.agentId} className="rounded-lg border border-border p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><div className="min-w-0"><p className="truncate font-semibold">{r.agent}</p><p className="text-xs text-muted-foreground">{r.employeeId}</p></div><p className="tabular text-lg font-bold">{r.conversionRate.toFixed(1)}%</p></div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <Metric label={t({ bn: "কল", en: "Calls" })} value={r.dials} />
                <Metric label={t({ bn: "কথা", en: "Connected" })} value={r.connected} />
                <Metric label={t({ bn: "কথা হার", en: "Connect %" })} value={`${r.connectRate.toFixed(1)}%`} />
                <Metric label={t({ bn: "সময়", en: "Talk time" })} value={formatMinutes(r.talkMinutes)} />
                <Metric label={t({ bn: "পাওয়া লিড", en: "Assigned" })} value={r.assigned} />
                <Metric label={t({ bn: "বুকিং", en: "Won" })} value={r.dealsWon} />
              </dl>
            </li>
          ))}
        </ul>
        <div className="table-scroll mt-3 hidden md:block">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">{t({ bn: "এজেন্ট", en: "Agent" })}</th>
                <Th>{t({ bn: "কল", en: "Dials" })}</Th>
                <Th>{t({ bn: "কথা", en: "Connected" })}</Th>
                <Th>{t({ bn: "কথা হার", en: "Connect %" })}</Th>
                <Th>{t({ bn: "সময়", en: "Talk time" })}</Th>
                <Th>{t({ bn: "গড় কল", en: "Avg call" })}</Th>
                <Th>{t({ bn: "হোয়াটসঅ্যাপ", en: "WhatsApp" })}</Th>
                <Th>{t({ bn: "লিড", en: "Assigned" })}</Th>
                <Th>{t({ bn: "বুকিং", en: "Won" })}</Th>
                <Th>{t({ bn: "সফল %", en: "Conv %" })}</Th>
                <th className="py-2 font-semibold">{t({ bn: "ফলাফল", en: "Performance" })}</th>
              </tr>
            </thead>
            <tbody className="zebra">
              {report.rows.map((r) => {
                const top = Math.max(...report.rows.map((x) => x.dials), 1);
                return (
                  <tr key={r.agentId} className="border-t border-border/70 hover:bg-muted/40">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{r.agent}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{r.employeeId}</span>
                    </td>
                    <Td>{r.dials}</Td>
                    <Td>{r.connected}</Td>
                    <Td>{r.connectRate.toFixed(1)}%</Td>
                    <Td>{formatMinutes(r.talkMinutes)}</Td>
                    <Td>{r.avgCallSeconds}s</Td>
                    <Td>{r.whatsapp}</Td>
                    <Td>{r.assigned}</Td>
                    <Td>{r.dealsWon}</Td>
                    <Td>{r.conversionRate.toFixed(1)}%</Td>
                    <td className="py-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round((r.dials / top) * 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="py-2 pr-3 text-right font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="tabular py-2 pr-3 text-right">{children}</td>;
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="rounded-md bg-muted p-2"><dt className="text-muted-foreground">{label}</dt><dd className="tabular mt-0.5 font-semibold">{value}</dd></div>;
}
