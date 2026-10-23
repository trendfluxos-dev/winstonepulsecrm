import { describe, expect, it } from "vitest";
import * as R from "@/lib/maintenance-rules";

const cents = (x: number) => Math.round(x * 100);

describe("subscription fee formulas (VAT added at 15%)", () => {
  it("Full OS: $46.29 + 15% = $6.94 VAT, $53.23 total", () => {
    expect(R.VAT_RATE).toBe(0.15);
    expect(cents(R.MAINTENANCE_FEE_USD * R.VAT_RATE)).toBe(cents(R.MAINTENANCE_FEE_VAT_USD));
    expect(cents(R.MAINTENANCE_FEE_USD) + cents(R.MAINTENANCE_FEE_VAT_USD)).toBe(cents(R.MAINTENANCE_FEE_TOTAL_USD));
    expect(R.MAINTENANCE_FEE_TOTAL_USD).toBe(53.23);
  });
  it("CRM-only: $15.79 + $2.37 VAT = $18.16 total", () => {
    expect(R.CRM_VAT_CENTS).toBe(237);
    expect(R.CRM_TOTAL_CENTS).toBe(1816);
  });
});
