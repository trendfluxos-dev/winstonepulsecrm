import { isFriday } from "@/lib/business-day";
import { MAX_DAILY_LEADS_PER_AGENT } from "@/lib/lead-quota";

/** Next 14 calendar days, starting today; Friday/configured closures need no allocation. */
export function leadPoolCoverage(agents: { id: string; name: string }[], targets: ReadonlyMap<string, number>, fallback: number, start: string, pool: number, holidays: readonly string[] = []) {
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const days = dates.filter((d) => !isFriday(d) && !holidays.includes(d));
  const rows = agents.map((a) => {
    const dailyTarget = Math.max(1, Math.min(MAX_DAILY_LEADS_PER_AGENT, targets.get(a.id) ?? fallback));
    return { ...a, dailyTarget, need: dailyTarget * days.length };
  });
  const dailyNeed = rows.reduce((s, a) => s + a.dailyTarget, 0);
  const need = rows.reduce((s, a) => s + a.need, 0);
  return { rows, dailyNeed, need, shortage: pool < need, shortfall: Math.max(0, need - pool), allocationDays: days.length, from: start, to: dates[13] ?? start };
}