import { describe, expect, it } from "vitest";
import { myProgress } from "@/lib/my-progress";

const base = { pendingLeads: 3, reportsToday: 7, connectedToday: 2 };

describe("agent's own daily progress", () => {
  it("shows 20 of 50 received with 30 still able to arrive", () => {
    const p = myProgress({ ...base, quota: 50, received: 20, distributionOpen: true });
    expect(p.stillToReceive).toBe(30);
    expect(p.quotaPct).toBe(40);
  });

  it("reports nothing left once all 50 are received", () => {
    expect(myProgress({ ...base, quota: 50, received: 50, distributionOpen: true }).stillToReceive).toBe(0);
  });

  it("promises no more leads when distribution is closed (e.g. Friday)", () => {
    expect(myProgress({ ...base, quota: 50, received: 10, distributionOpen: false }).stillToReceive).toBe(0);
  });

  it("never invents a quota number when the server count is missing", () => {
    const p = myProgress({ ...base, quota: 50, received: null, distributionOpen: null });
    expect(p.stillToReceive).toBeNull();
    expect(p.quotaPct).toBeNull();
  });
});
