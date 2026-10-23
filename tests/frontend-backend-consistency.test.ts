import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MAX_DAILY_LEADS_PER_AGENT } from "../src/lib/lead-quota";
import { MAINTENANCE_FEE_USD } from "../src/lib/maintenance-rules";

describe("frontend matches server rules", () => {
  it("lead forms cannot request more than the 50/day database cap", () => {
    expect(MAX_DAILY_LEADS_PER_AGENT).toBe(50);
    for (const f of ["src/lib/lead-pool.functions.ts", "src/lib/coordinator-deck.functions.ts"])
      expect(readFileSync(f, "utf8")).not.toMatch(/max\(500\)/);
  });
  it("billing notices use the 15th 00:00 deadline, not the retired 12th", () => {
    expect(MAINTENANCE_FEE_USD).toBe(35.29);
    expect(readFileSync("src/components/crm/MaintenanceNotice.tsx", "utf8")).not.toMatch(/12th/);
  });
});
