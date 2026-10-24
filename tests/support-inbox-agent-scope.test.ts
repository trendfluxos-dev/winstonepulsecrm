import { describe, expect, it } from "vitest";
import { inboxVisible } from "@/lib/support-staff.functions";

describe("Sales Agent support inbox shows only own assigned conversations", () => {
  it("shows a conversation assigned to the signed-in agent", () => {
    expect(inboxVisible("agent", "agent-a", "agent-a")).toBe(true);
  });
  it("hides unassigned conversations from agents", () => {
    expect(inboxVisible("agent", "agent-a", null)).toBe(false);
  });
  it("hides another agent's conversation", () => {
    expect(inboxVisible("agent", "agent-a", "agent-b")).toBe(false);
  });
  it("agent without a profile sees nothing", () => {
    expect(inboxVisible("agent", null, null)).toBe(false);
  });
  it("admins and coordinators still see every conversation", () => {
    expect(inboxVisible("authority", null, null)).toBe(true);
    expect(inboxVisible("coordinator", "x", "agent-b")).toBe(true);
  });
});
