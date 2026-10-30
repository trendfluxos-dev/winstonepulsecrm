/** Pure, browser-safe date-range rules for Search Console reads. */
export const GSC_MAX_LOOKBACK_DAYS = 486; // Google keeps ~16 months of data.
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type DateRange = { startDate: string; endDate: string };

function toDay(s: string): number | null {
  if (!ISO.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return null;
  return Math.floor(t / 86400_000);
}

/** Returns an error message, or null when the range is valid. `today` is a Dhaka YYYY-MM-DD. */
export function validateRange(r: DateRange, today: string): string | null {
  const s = toDay(r.startDate), e = toDay(r.endDate), n = toDay(today);
  if (s == null || e == null || n == null) return "Use valid dates (YYYY-MM-DD)";
  if (s > e) return "Start date must be on or before the end date";
  if (e > n) return "End date cannot be in the future";
  if (n - s > GSC_MAX_LOOKBACK_DAYS) return "Google keeps only about 16 months of search data";
  return null;
}

/** The period of equal length that ends the day before `r` starts. */
export function previousPeriod(r: DateRange): DateRange {
  const s = toDay(r.startDate)!, e = toDay(r.endDate)!;
  const len = e - s + 1;
  const iso = (d: number) => new Date(d * 86400_000).toISOString().slice(0, 10);
  return { startDate: iso(s - len), endDate: iso(s - 1) };
}

/** Percent change from b to a; null when there is no baseline. */
export function pctChange(a: number, b: number): number | null {
  if (!b) return null;
  return (a - b) / b;
}
