import { describe, expect, it } from "vitest";
import { safeDistributionReason, parseFailureDetail } from "@/lib/distribution-failure";
describe("safe automatic distribution failures", () => {
  it("identifies timeout without exposing the raw error", () => {
    expect(safeDistributionReason(new Error("canceling statement due to statement timeout: private customer"))).toBe("timeout");
  });
  it("identifies the enforced daily cap", () => {
    expect(safeDistributionReason(new Error("Daily lead cap reached: 50 leads per agent per Dhaka day"))).toBe("quota");
  });
  it("identifies missing active agents", () => { expect(safeDistributionReason(new Error("চালু কোনো এজেন্ট নেই"))).toBe("no_agents"); });
  it("never returns credentials or arbitrary error bodies", () => {
    expect(safeDistributionReason(new Error("password=private token=private"))).toBe("unknown");
    expect(parseFailureDetail('{"reason":"secret","stage":"customer"}')).toEqual({ reason: "unknown", stage: "prepare" });
  });
  it("handles malformed legacy detail safely", () => { expect(parseFailureDetail("raw private error")).toEqual({ reason: "unknown", stage: "prepare" }); });
});