import { describe, expect, it } from "vitest";
import { bnDate, bnNum, hqSummaryParams, hqTotals, normalizeRecipientList, scriptRuns, sortAgentRows } from "@/lib/hq-daily-report";

const rows = [
  { name: "Rahim", received: 50, reports: 40, verifiedConnected: 22, newFollowUps: 6 },
  { name: "Karim", received: 48, reports: 0, verifiedConnected: 0, newFollowUps: 0 },
  { name: "Asha", received: 50, reports: 45, verifiedConnected: 30, newFollowUps: 9 },
];

describe("HQ daily WhatsApp report", () => {
  it("sends to exactly the three requested HQ numbers", () => {
    expect(normalizeRecipientList(["+880 1730-320178", "+880 1819-225751", "+880 1766-667640"]))
      .toEqual(["8801730320178", "8801819225751", "8801766667640"]);
  });
  it("totals counts; only agents with a report count as active", () => {
    expect(hqTotals(rows)).toEqual({ received: 148, reports: 85, verifiedConnected: 52, newFollowUps: 15, activeAgents: 2 });
  });
  it("writes the summary in Bangla numerals and date", () => {
    expect(bnNum(148)).toBe("১৪৮");
    expect(bnDate("2026-10-31")).toBe("৩১ অক্টোবর ২০২৬");
    expect(hqSummaryParams("2026-10-31", hqTotals(rows))).toEqual(["৩১ অক্টোবর ২০২৬", "১৪৮", "৮৫", "৫২", "১৫", "২"]);
  });
  it("orders agents by reports submitted", () => {
    expect(sortAgentRows(rows).map((r) => r.name)).toEqual(["Asha", "Rahim", "Karim"]);
  });
  it("keeps Bangla and Latin in separate runs", () => {
    expect(scriptRuns("Rahim · রিপোর্ট ৪০").map((r) => r.bengali)).toEqual([false, true]);
  });
});
