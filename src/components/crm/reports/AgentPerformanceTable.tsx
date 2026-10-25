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

/** One-line plain-language summary shown beside each agent row. */
function agentSummary(
  r: ReportResult["rows"][number],
  t: ReturnType<typeof useT>,
): string {
  if (r.dials === 0) {
    return r.assigned > 0
      ? t({ bn: "লিড পেয়েছেন, এখনো কোনো কল দেননি — কল শুরু করুন।", en: "Leads assigned but no calls yet — start calling." })
      : t({ bn: "এই সময়ে কোনো কল দেননি।", en: "No calls in this period." });
  }
  const facts = t({
    bn: `${r.dials}টি কল, ${r.connected}টিতে কথা, ${r.dealsWon}টি বুকিং।`,
    en: `${r.dials} call${r.dials === 1 ? "" : "s"}, ${r.connected} answered, ${r.dealsWon} booking${r.dealsWon === 1 ? "" : "s"}.`,
  });
  let tip = t({ bn: "ভালো চলছে — এভাবেই চালিয়ে যান।", en: "On track — keep going." });
  if (r.connectRate < 40) {
    tip = t({ bn: "কথা হওয়ার হার কম — কলের সময় বা ভঙ্গি বদলে দেখুন।", en: "Low answer rate — try a different call time or approach." });
  } else if (r.assigned > 0 && r.dealsWon === 0) {
    tip = t({ bn: "কথা হচ্ছে, বুকিং হয়নি — ফলো-আপ ধরে রাখুন।", en: "Calls connect, no bookings yet — keep following up." });
  } else if (r.avgCallSeconds < 30) {
    tip = t({ bn: "কলগুলো ছোট — গ্রাহকের সাথে আরেকটু বেশি কথা বলুন।", en: "Calls are short — talk a bit longer with customers." });
  }
  return `${facts} ${tip}`;
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
          <details className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-foreground">
              {t({ bn: "কীভাবে পড়বেন? (সহজ ব্যাখ্যা)", en: "How to read this (simple guide)" })}
            </summary>
              <li>{t({ bn: "কথা হয়েছে = কত কলে কাস্টমার কথা ধরেছে। % দেখায় ১০০ কলে কতটুকু কথা হয়েছে।", en: "Answered = calls the customer picked up. The % shows answered out of every 100 calls." })}</li>
              <li>{t({ bn: "কল দেওয়া = এজেন্ট যতবার ফোন করেছে।", en: "Calls made = how many times the agent phoned." })}</li>
              <li>{t({ bn: "বুকিংয়ের হার = পাওয়া লিডের মধ্যে কতটুকু বুকিং হয়েছে। বেশি হলে ভালো।", en: "Booking rate = how many of the assigned leads became bookings. Higher is better." })}</li>
              <li>{t({ bn: "কথার সময় = সব কল মিলে মোট কতক্ষণ কথা হয়েছে।", en: "Talk time = total minutes spent talking." })}</li>
              <li>{t({ bn: "বুকিংয়ের হার = পাওয়া লিডের মধ্যে কত শতাংশ বুকিং হয়েছে। বেশি হলে ভালো।", en: "Booking rate = how many of the assigned leads became bookings. Higher is better." })}</li>
            </ul>
          </details>
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
              <p className="mt-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-xs leading-snug">{agentSummary(r, t)}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <Metric label={t({ bn: "কল দেওয়া", en: "Calls made" })} value={r.dials} />
                <Metric label={t({ bn: "কথা হয়েছে", en: "Answered" })} value={r.connected} />
                <Metric label={t({ bn: "কথা হওয়ার হার", en: "Answer rate" })} value={`${r.connectRate.toFixed(1)}%`} />
                <Metric label={t({ bn: "কথার সময়", en: "Talk time" })} value={formatMinutes(r.talkMinutes)} />
                <Metric label={t({ bn: "পাওয়া লিড", en: "Leads given" })} value={r.assigned} />
                <Metric label={t({ bn: "বুকিং", en: "Bookings" })} value={r.dealsWon} />
              </dl>
            </li>
          ))}
        </ul>
        <div className="table-scroll mt-3 hidden md:block">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">{t({ bn: "এজেন্ট", en: "Agent" })}</th>
                <th className="py-2 pr-3 font-semibold">{t({ bn: "সহজ সারাংশ", en: "Quick summary" })}</th>
                <Th>{t({ bn: "কল দেওয়া", en: "Calls made" })}</Th>
                <Th>{t({ bn: "কথা হয়েছে", en: "Answered" })}</Th>
                <Th>{t({ bn: "কথার হার", en: "Answer rate" })}</Th>
                <Th>{t({ bn: "কথার সময়", en: "Talk time" })}</Th>
                <Th>{t({ bn: "গড়ে একটি কল", en: "Avg call" })}</Th>
                <Th>{t({ bn: "হোয়াটসঅ্যাপ", en: "WhatsApp" })}</Th>
                <Th>{t({ bn: "পাওয়া লিড", en: "Leads given" })}</Th>
                <Th>{t({ bn: "বুকিং", en: "Bookings" })}</Th>
                <Th>{t({ bn: "বুকিংয়ের হার", en: "Booking rate" })}</Th>
                <th className="py-2 font-semibold">{t({ bn: "কাজের ধারা", en: "Activity bar" })}</th>
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
                    <td className="py-2 pr-3 text-xs leading-snug text-muted-foreground">{agentSummary(r, t)}</td>
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
