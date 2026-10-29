import { describe, expect, it } from "vitest";
import { sandboxResultSchema, simulateSandbox } from "../src/lib/call-sandbox";
describe("isolated call sandbox", () => {
  it("never emits live writes or synthetic call evidence from summary simulation", () => {
    const result = simulateSandbox(" Customer wants a test brochure. ", 1234);
    expect(result.liveWrites).toBe(0); expect(result.calls).toEqual([]);
    expect(result.recording).toBe("not_checked"); expect(result.summary).toBe("simulation_saved");
  });
  it("reports empty summary simulation as failed", () => { expect(simulateSandbox(" ", 1234).summary).toBe("simulation_failed"); });
  it("rejects production IDs and claimed live writes", () => {
    const result = simulateSandbox("test", 1234);
    expect(sandboxResultSchema.safeParse({ ...result, liveWrites: 1 }).success).toBe(false);
    expect(sandboxResultSchema.safeParse({ ...result, calls: [{ leadId: "production-id", at: 1, type: 1, durationSeconds: 3 }] }).success).toBe(false);
  });
  it("rejects raw numbers and extra credential fields", () => { expect(sandboxResultSchema.safeParse({ ...simulateSandbox("test", 1234), token: "not-allowed" }).success).toBe(false); });
  it("bounds imported call rows", () => { expect(sandboxResultSchema.safeParse({ ...simulateSandbox("test", 1234), calls: Array(21).fill({ leadId: "synthetic-001", at: 1, type: 1, durationSeconds: 3 }) }).success).toBe(false); });
});