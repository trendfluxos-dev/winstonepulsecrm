import { z } from "zod";

/** Proposed CRM fields only; Windsor's wire schema remains unverified. */
export const WINDSOR_REPORT_FIELDS = ["date", "campaign_name", "impressions", "clicks", "spend", "currency"] as const;
export const WINDSOR_MAX_DAYS = 31;
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
export const WindsorReportRequest = z.object({
  from: calendarDate, to: calendarDate,
  timezone: z.literal("Asia/Dhaka"),
  fields: z.array(z.enum(WINDSOR_REPORT_FIELDS)).min(1).max(WINDSOR_REPORT_FIELDS.length),
}).strict().superRefine((data, ctx) => {
  const days = (Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86_400_000 + 1;
  if (days < 1 || days > WINDSOR_MAX_DAYS) ctx.addIssue({ code: "custom", message: "Choose 1–31 inclusive calendar days" });
  if (new Set(data.fields).size !== data.fields.length) ctx.addIssue({ code: "custom", message: "Duplicate report fields" });
});
/** No transport or storage dependencies. Configured never means connected. */
export function disconnectedWindsorReport(configured: boolean) {
  return {
    connected: false as const, configured,
    reason: configured ? "API_CONTRACT_UNVERIFIED" as const : "NOT_CONFIGURED" as const,
    rows: [] as never[], fetchedAt: null,
    accountVerified: false as const, providerTimezoneVerified: false as const,
  };
}
export type WindsorStatus = ReturnType<typeof disconnectedWindsorReport>;
export function canInspectWindsorConfiguration(scope: string | null) { return scope === "full"; }