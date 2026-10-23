import { describe, expect, it } from "vitest";

import { accessState, invoiceStatus } from "@/lib/maintenance-rules";
import { evaluateManualHtml } from "@/lib/release-check";

const lockAt = "2026-11-14T18:00:00.000Z"; // 15 Nov 00:00 Dhaka
const base = { lockAt, unlockStatus: "none" as const, unlockExpiresAt: null };

describe("live release check", () => {
  const good = `<p>Manual version <!-- -->1.6.0</p> $35.29 ... exactly 50 unique leads per agent`;
  it("passes only when version, charge and quota all show", () => {
    expect(evaluateManualHtml(good).deployed).toBe(true);
  });
  it("fails on the old 1.5.0 manual", () => {
    expect(evaluateManualHtml(good.replace("1.6.0", "1.5.0")).deployed).toBe(false);
  });
  it("fails without the $35.29 charge", () => {
    expect(evaluateManualHtml(good.replace("$35.29", "$53.23")).deployed).toBe(false);
  });
  it("fails without the 50-lead limit", () => {
    expect(evaluateManualHtml(good.replace("exactly 50 unique leads", "25 leads")).deployed).toBe(false);
  });
});

describe("approval → verification → lock → reactivation (no records touched)", () => {
  const before = new Date("2026-11-14T17:59:59Z");
  const after = new Date("2026-11-14T18:00:00Z");
  it("approval is not payment and does not keep access after the deadline", () => {
    expect(invoiceStatus({ now: before, lockAt, paymentStatus: "unpaid", approvedAt: "2026-11-10T00:00:00Z" })).toBe("APPROVED");
    expect(invoiceStatus({ now: after, lockAt, paymentStatus: "unpaid", approvedAt: "2026-11-10T00:00:00Z" })).toBe("LOCKED");
    expect(accessState({ ...base, now: after, paymentStatus: "unpaid" })).toBe("LOCKED");
  });
  it("still active at 14th 23:59:59 Dhaka", () => {
    expect(accessState({ ...base, now: before, paymentStatus: "unpaid" })).toBe("ACTIVE");
  });
  it("late verified payment reactivates", () => {
    const late = new Date("2026-11-20T00:00:00Z");
    expect(invoiceStatus({ now: late, lockAt, paymentStatus: "verified", approvedAt: null })).toBe("PAID");
    expect(accessState({ ...base, now: late, paymentStatus: "verified" })).toBe("ACTIVE");
  });
  it("pending proof does not unlock", () => {
    expect(accessState({ ...base, now: after, paymentStatus: "pending" })).toBe("LOCKED");
  });
});
