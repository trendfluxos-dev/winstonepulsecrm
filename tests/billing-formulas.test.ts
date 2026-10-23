import { describe, expect, it } from "vitest";
import * as R from "@/lib/maintenance-rules";

const dhaka = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) =>
  new Date(Date.UTC(y, mo - 1, d, h, mi, s) - 6 * 3600_000);

describe("monthly architecture charge: $35.29 USD, 15% VAT included", () => {
  it("total is 3529 cents; base = round(3529/1.15) = 3069; VAT = 460", () => {
    expect(R.ARCH_TOTAL_CENTS).toBe(3529);
    expect(R.ARCH_BASE_CENTS).toBe(3069);
    expect(R.ARCH_VAT_CENTS).toBe(460);
    expect(R.ARCH_BASE_CENTS + R.ARCH_VAT_CENTS).toBe(3529);
    expect(R.MAINTENANCE_FEE_TOTAL_USD).toBe(35.29);
    expect(R.MAINTENANCE_FEE_USD).toBe(35.29);
    expect(R.MAINTENANCE_FEE_LABEL).not.toMatch(/53\.23|46\.29|18\.16/);
  });
  it("historical CRM snapshot constants stay unchanged (1579 + 237 = 1816)", () => {
    expect(R.CRM_TOTAL_CENTS).toBe(1816);
  });
});

describe("deadline = first instant of the 15th, Asia/Dhaka", () => {
  const lockAt = R.defaultLockAt("2026-11");
  it("UTC conversion: 15th 00:00 Dhaka = 14th 18:00 UTC", () => {
    expect(lockAt).toBe("2026-11-14T18:00:00.000Z");
    expect(R.defaultDueAt("2026-11")).toBe(lockAt);
  });
  it("month boundary: December deadline, January period", () => {
    expect(R.defaultLockAt("2026-12")).toBe("2026-12-14T18:00:00.000Z");
    expect(R.dhakaPeriod(new Date("2026-12-31T18:00:00.000Z"))).toBe("2027-01");
  });
  const base = { lockAt, unlockStatus: "none" as const, unlockExpiresAt: null };
  it("14th 23:59:59 Dhaka unpaid → ACTIVE; 15th 00:00 → LOCKED", () => {
    expect(R.accessState({ ...base, now: dhaka(2026, 11, 14, 23, 59, 59), paymentStatus: "unpaid" })).toBe("ACTIVE");
    expect(R.accessState({ ...base, now: dhaka(2026, 11, 15), paymentStatus: "unpaid" })).toBe("LOCKED");
    expect(R.accessState({ ...base, now: dhaka(2026, 11, 15), paymentStatus: "pending" })).toBe("LOCKED");
  });
  it("verified payment is ACTIVE at and after the deadline (late verification restores)", () => {
    expect(R.accessState({ ...base, now: dhaka(2026, 11, 15), paymentStatus: "verified" })).toBe("ACTIVE");
    expect(R.accessState({ ...base, now: dhaka(2026, 11, 20), paymentStatus: "verified" })).toBe("ACTIVE");
  });
});

describe("invoice lifecycle ISSUED → APPROVED → PAID / LOCKED", () => {
  const lockAt = R.defaultLockAt("2026-11");
  const before = dhaka(2026, 11, 14, 23, 59, 59);
  const after = dhaka(2026, 11, 15);
  it("issued, then approved before the deadline", () => {
    expect(R.invoiceStatus({ now: before, lockAt, paymentStatus: "unpaid", approvedAt: null })).toBe("ISSUED");
    expect(R.invoiceStatus({ now: before, lockAt, paymentStatus: "unpaid", approvedAt: before.toISOString() })).toBe("APPROVED");
  });
  it("approval is not payment: approved + unverified locks at the deadline", () => {
    expect(R.invoiceStatus({ now: after, lockAt, paymentStatus: "pending", approvedAt: before.toISOString() })).toBe("LOCKED");
  });
  it("PAID only from verified payment, even late", () => {
    expect(R.invoiceStatus({ now: after, lockAt, paymentStatus: "verified", approvedAt: null })).toBe("PAID");
  });
});
