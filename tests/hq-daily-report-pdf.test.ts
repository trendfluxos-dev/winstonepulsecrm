import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildHqDailyReportPdf } from "@/lib/hq-daily-report-pdf.server";

describe("HQ daily report PDF", () => {
  it("builds a Bangla PDF from counts only", async () => {
    const rows = Array.from({ length: 34 }, (_, i) => ({ name: `Agent ${i + 1}`, received: 50 - (i % 5), reports: 40 - i, verifiedConnected: 20 - (i % 7), newFollowUps: i % 6 }));
    const bytes = await buildHqDailyReportPdf({ day: "2026-10-31", rows, generatedAt: new Date("2026-10-31T11:40:00Z"), sample: true });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    if (process.env["HQ_PDF_OUT"]) writeFileSync(process.env["HQ_PDF_OUT"], bytes);
  }, 30_000);
});
