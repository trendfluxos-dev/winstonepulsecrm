import { describe, expect, it } from "vitest";
import { crmWorkReview } from "@/lib/crm-work-review";

describe("read-only CRM work evidence", () => {
  it("uses exact saved counts and labels the snapshot as sampled", () => {
    const result = crmWorkReview({ totals: { leads: 50, pending_leads: 12, unfinished_reports: 3, open_follow_ups: 7 }, review_counts: { missed_follow_ups: 2, due_follow_ups: 4 } });
    expect(result.sampled).toBe(true);
    expect(result.counts).toEqual({ leads_in_sample: 50, pending_leads_in_sample: 12, unfinished_reports_in_sample: 3, open_follow_ups_in_sample: 7, missed_follow_ups_in_sample: 2, due_follow_ups_in_sample: 4 });
  });

  it("never forwards customer fields, IDs or free-text errors", () => {
    const result = crmWorkReview({ totals: { leads: 0, pending_leads: 0, unfinished_reports: 0, open_follow_ups: 0 }, review_counts: { missed_follow_ups: 0, due_follow_ups: 0 }, leads_sample: [{ phone: "private", id: "customer" }], sync_failures: [{ error_message: "secret" }] } as Parameters<typeof crmWorkReview>[0]);
    expect(JSON.stringify(result)).not.toMatch(/private|customer|secret/);
    expect(result.counts.pending_leads_in_sample).toBe(0);
  });
});