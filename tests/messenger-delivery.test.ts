import { describe, expect, it } from "vitest";

import { emptyDeliverySummary, summarizeDeliveryRows } from "@/lib/messenger-delivery";

describe("messenger delivery summary", () => {
  it("counts processed and pending receipts", () => {
    const summary = summarizeDeliveryRows({
      receipts: [
        { received_at: "2026-10-25T01:00:00Z", processed_at: "2026-10-25T01:00:01Z" },
        { received_at: "2026-10-25T01:01:00Z", processed_at: null },
      ],
      events: [],
      outbox: [],
    });
    expect(summary.receipts).toEqual({ total: 2, processed: 1, pending: 1 });
    expect(summary.storageReady).toBe(true);
  });

  it("groups thread events by delivery status kind", () => {
    const summary = summarizeDeliveryRows({
      receipts: [],
      events: [
        { action: "delivery", created_at: "2026-10-25T01:00:00Z" },
        { action: "delivery", created_at: "2026-10-25T01:01:00Z" },
        { action: "read", created_at: "2026-10-25T01:02:00Z" },
        { action: "postback", created_at: "2026-10-25T01:03:00Z" },
        { action: "echo", created_at: "2026-10-25T01:04:00Z" },
        { action: "something_else", created_at: "2026-10-25T01:05:00Z" },
      ],
      outbox: [],
    });
    expect(summary.statuses).toEqual({ delivery: 2, read: 1, postback: 1, echo: 1 });
  });

  it("separates sent, failed and pending outbox rows and keeps the latest failure", () => {
    const summary = summarizeDeliveryRows({
      receipts: [],
      events: [],
      outbox: [
        { sent_mid: "m_1", last_error: null, created_at: "2026-10-25T01:00:00Z" },
        { sent_mid: null, last_error: "SEND_REFUSED", created_at: "2026-10-25T01:01:00Z" },
        { sent_mid: null, last_error: "TOKEN_EXPIRED", created_at: "2026-10-25T01:02:00Z" },
        { sent_mid: null, last_error: null, created_at: "2026-10-25T01:03:00Z" },
      ],
    });
    expect(summary.outbox).toEqual({ pendingRetries: 1, sent: 1, failed: 2 });
    expect(summary.lastFailure).toEqual({ code: "TOKEN_EXPIRED", at: "2026-10-25T01:02:00Z" });
  });

  it("marks storage-not-ready explicitly instead of pretending to be empty", () => {
    const summary = emptyDeliverySummary(false);
    expect(summary.storageReady).toBe(false);
    expect(summary.receipts.total).toBe(0);
    expect(summary.lastFailure).toBeNull();
  });

  it("never carries message content — only counts and codes", () => {
    const summary = summarizeDeliveryRows({
      receipts: [{ received_at: "2026-10-25T01:00:00Z", processed_at: null }],
      events: [{ action: "delivery", created_at: "2026-10-25T01:00:00Z" }],
      outbox: [{ sent_mid: null, last_error: "X", created_at: "2026-10-25T01:00:00Z" }],
    });
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("body");
    expect(serialized).not.toContain("psid");
  });
});
