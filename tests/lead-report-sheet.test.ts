import { describe, expect, it } from "vitest";
import {
  LEAD_REPORT_HEADER,
  dhakaDateLabel,
  toLeadReportLine,
  type LeadReportRow,
} from "@/lib/lead-report-sheet.server";

const row: LeadReportRow = {
  leadId: "93d8fffe-16cd-47b4-a350-2873320256c0",
  leadName: "Refayet Anzir Shuvo",
  phone: "01675837243",
  agentName: "Sabbir Ahmmed",
  status: "closed",
  stage: "enquiry",
  visits: 2,
  visitsCompleted: 1,
  bookings: 1,
  paymentStatus: "—",
  lastActivityDhaka: "14:51",
};

describe("lead report sheet rows", () => {
  it("keeps the exact 14-column layout of the existing Daily Lead Report", () => {
    expect(LEAD_REPORT_HEADER).toHaveLength(14);
    expect(LEAD_REPORT_HEADER[0]).toBe("Lead");
    expect(LEAD_REPORT_HEADER[13]).toBe("Lead ID");
    const line = toLeadReportLine(row, "2026-10-25T03:00:00Z");
    expect(line).toHaveLength(14);
    expect(line[0]).toBe("Refayet Anzir Shuvo");
    expect(line[5]).toBe("2");
    expect(line[6]).toBe("1");
    expect(line[10]).toBe("2026-10-25T03:00:00Z");
    expect(line[13]).toBe(row.leadId);
  });

  it("neutralises formula-like cell content", () => {
    const hostile = toLeadReportLine({ ...row, leadName: "=HYPERLINK(\"http://x\")" }, "t");
    expect(hostile[0].startsWith("'")).toBe(true);
  });

  it("labels tabs with the Dhaka calendar date", () => {
    // 2026-10-25 02:00 UTC is 08:00 in Dhaka — same day.
    expect(dhakaDateLabel(new Date("2026-10-25T02:00:00Z"))).toBe("2026-10-25");
    // 2026-10-24 20:00 UTC is 2026-10-25 02:00 in Dhaka — next day.
    expect(dhakaDateLabel(new Date("2026-10-24T20:00:00Z"))).toBe("2026-10-25");
  });
});
