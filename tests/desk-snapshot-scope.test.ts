import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | { scope: string; profile: { id: string } | null },
  pinCaller: { scope: "authority", profile: null },
  workCalls: [] as (string | null | undefined)[],
  callerCalls: [] as (string | null | undefined)[],
}));

vi.mock("@/lib/access.server", () => ({
  resolveWorkCaller: async (token: string | null | undefined) => {
    mocks.workCalls.push(token);
    return token == null ? mocks.session ?? { scope: "none", profile: null } : mocks.pinCaller;
  },
  resolveCaller: async (token: string | null | undefined) => {
    mocks.callerCalls.push(token);
    return mocks.pinCaller;
  },
}));

import { resolveSnapshotCaller } from "@/lib/crm.functions";

beforeEach(() => {
  mocks.session = null;
  mocks.workCalls.length = 0;
  mocks.callerCalls.length = 0;
});

describe("My Desk snapshot scoping", () => {
  it("a signed-in agent keeps their own scope even with an HQ PIN token in the browser", async () => {
    mocks.session = { scope: "agent", profile: { id: "me" } };
    const caller = await resolveSnapshotCaller("hq-pin-token", "agent");
    expect(caller.profile?.id).toBe("me");
    expect(caller.scope).toBe("agent");
    // The PIN must never be consulted once a staff session exists.
    expect(mocks.workCalls).toEqual([null]);
  });

  it("falls back to the PIN caller only when nobody is signed in", async () => {
    const caller = await resolveSnapshotCaller("hq-pin-token", "agent");
    expect(caller.scope).toBe("authority");
    expect(mocks.workCalls).toEqual([null, "hq-pin-token"]);
  });

  it("the floor view keeps the existing token-first behaviour", async () => {
    mocks.session = { scope: "agent", profile: { id: "me" } };
    const caller = await resolveSnapshotCaller("hq-pin-token", "default");
    expect(caller.scope).toBe("authority");
    expect(mocks.callerCalls).toEqual(["hq-pin-token"]);
    expect(mocks.workCalls).toEqual([]);
  });
});
