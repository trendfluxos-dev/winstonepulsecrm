import { describe, expect, it } from "vitest";
import { SetTargetInput } from "@/lib/agent-targets.functions";

const agentId = "00000000-0000-4000-8000-000000000001";

describe("HQ per-agent daily target", () => {
  it("accepts 1 and 50", () => {
    expect(SetTargetInput.safeParse({ agentId, target: 1 }).success).toBe(true);
    expect(SetTargetInput.safeParse({ agentId, target: 50 }).success).toBe(true);
  });
  it("rejects 0 and 51 (50 stays the hard cap)", () => {
    expect(SetTargetInput.safeParse({ agentId, target: 0 }).success).toBe(false);
    expect(SetTargetInput.safeParse({ agentId, target: 51 }).success).toBe(false);
  });
});
