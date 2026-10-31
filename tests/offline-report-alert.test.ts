import { describe, expect, it } from "vitest";
import { stuckReports } from "@/lib/offline-status";
import type { OfflineItem, SentItem } from "@/lib/offline-queue";

const now = Date.parse("2026-10-31T08:30:00Z");
const item = (extra: Partial<OfflineItem>): OfflineItem => ({
  id: "r", kind: "report_submit", createdAt: "2026-10-31T08:29:00Z", status: "pending", attempts: 0, label: "Rahim", payload: {}, ...extra,
});

describe("offline report alerts", () => {
  it("alerts when a report has been Syncing for 2 minutes", () => {
    const r = stuckReports([item({ status: "syncing", lastAttemptAt: "2026-10-31T08:28:00Z" })], [], now);
    expect(r.map((x) => x.reason)).toEqual(["syncing_too_long"]);
  });

  it("does not alert for a report syncing for under 2 minutes", () => {
    expect(stuckReports([item({ status: "syncing", lastAttemptAt: "2026-10-31T08:28:30Z" })], [], now)).toEqual([]);
  });

  it("alerts when a report is still not Sent 15 minutes after it was queued", () => {
    const r = stuckReports([item({ status: "failed", createdAt: "2026-10-31T08:15:00Z" })], [], now);
    expect(r.map((x) => x.reason)).toEqual(["not_sent"]);
    expect(stuckReports([item({ createdAt: "2026-10-31T08:15:01Z" })], [], now)).toEqual([]);
  });

  it("alerts when the server refused a report, never for a sent one", () => {
    const sent: SentItem[] = [
      { id: "a", kind: "report_submit", label: "A", createdAt: "x", sentAt: "2026-10-31T08:20:00Z", outcome: "not_accepted" },
      { id: "b", kind: "report_submit", label: "B", createdAt: "x", sentAt: "2026-10-31T08:20:00Z", outcome: "sent" },
    ];
    expect(stuckReports([], sent, now).map((x) => [x.id, x.reason])).toEqual([["a", "refused"]]);
  });

  it("ignores queued call events (only reports alert)", () => {
    expect(stuckReports([item({ kind: "call_event", createdAt: "2026-10-31T07:00:00Z" })], [], now)).toEqual([]);
  });
});

import { readOfflineAlertConfig, offlineAlertSchema } from "@/lib/offline-alert-config";

describe("configurable alert times", () => {
  it("defaults to 2 and 15 minutes when nothing valid is saved", () => {
    expect(readOfflineAlertConfig(null)).toEqual({ syncingMinutes: 2, notSentMinutes: 15 });
    expect(readOfflineAlertConfig({ syncingMinutes: 0, notSentMinutes: 15 })).toEqual({ syncingMinutes: 2, notSentMinutes: 15 });
  });
  it("rejects a not-sent time that is not longer than the syncing time", () => {
    expect(offlineAlertSchema.safeParse({ syncingMinutes: 10, notSentMinutes: 10 }).success).toBe(false);
  });
  it("uses saved times: 5-minute syncing and 30-minute not-sent", () => {
    const limits = readOfflineAlertConfig({ syncingMinutes: 5, notSentMinutes: 30 });
    const syncing = item({ status: "syncing", lastAttemptAt: "2026-10-31T08:27:00Z" });
    expect(stuckReports([syncing], [], now, limits)).toEqual([]);
    expect(stuckReports([item({ createdAt: "2026-10-31T08:00:00Z" })], [], now, limits).map((x) => x.reason)).toEqual(["not_sent"]);
    expect(stuckReports([item({ createdAt: "2026-10-31T08:10:00Z" })], [], now, limits)).toEqual([]);
  });
});
