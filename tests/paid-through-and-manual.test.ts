import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { decide, defaultLockAt, dhakaPeriod, nextPeriod, paidThrough } from "@/lib/maintenance-rules";
import { parseManual } from "@/lib/manual-source";
import { MANUAL_SECTIONS, MANUAL_VERSION } from "@/lib/system-manual";

describe("paid-through (verified October 2026 covers through 14 Nov 23:59:59 Dhaka)", () => {
  it("verified 2026-10 → active until the 2026-11 lock", () => {
    expect(paidThrough("2026-10", "verified")).toEqual({
      lastActiveInstant: "2026-11-14T17:59:59.000Z",
      nextLockAt: "2026-11-14T18:00:00.000Z",
    });
  });
  it("unverified months never get a paid-through", () => {
    expect(paidThrough("2026-10", "pending")).toBeNull();
    expect(paidThrough("2026-10", "unpaid")).toBeNull();
  });
  it("14 Nov 23:59:59 Dhaka is still the October period; 15 Nov 00:00 is November", () => {
    expect(dhakaPeriod(new Date("2026-11-14T17:59:59Z"))).toBe("2026-11");
    expect(defaultLockAt("2026-11")).toBe("2026-11-14T18:00:00.000Z");
  });
  it("unpaid November bill: active at 14 Nov 23:59:59 Dhaka, locked at 15 Nov 00:00", () => {
    const b = { lockAt: defaultLockAt("2026-11"), paymentStatus: "unpaid" as const, unlockStatus: "none" as const, unlockExpiresAt: null };
    expect(decide({ ...b, now: new Date("2026-11-14T17:59:59Z") }).locked).toBe(false);
    expect(decide({ ...b, now: new Date("2026-11-14T18:00:00Z") }).locked).toBe(true);
  });
  it("Dec → Jan rollover", () => {
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });
  it("new-month bill insert names the real unique key", () => {
    expect(readFileSync("src/lib/maintenance.server.ts", "utf8")).toMatch(/onConflict: "billing_period,plan_code"/);
  });
});

describe("manual single source", () => {
  const md = readFileSync("docs/CRM_OPERATIONS_MANUAL.md", "utf8");
  it("/manual sections come from the Markdown file", () => {
    expect(MANUAL_SECTIONS).toEqual(parseManual(md).sections);
    expect(MANUAL_VERSION).toBe("1.6.0");
  });
  it("PDF metadata matches the Markdown hash and version", () => {
    const meta = JSON.parse(readFileSync("public/winstone-system-manual.json", "utf8"));
    expect(meta.sourceSha256).toBe(createHash("sha256").update(readFileSync("docs/CRM_OPERATIONS_MANUAL.md")).digest("hex"));
    expect(meta.version).toBe(MANUAL_VERSION);
  });
});
