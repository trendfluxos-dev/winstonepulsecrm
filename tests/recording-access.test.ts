import { describe, expect, it } from "vitest";

import { hasFullRecordingAccess } from "@/lib/recording-access";

describe("who may hear any recording regardless of lead ownership", () => {
  it("HQ/IT PIN session (no profile) hears every recording", () => {
    expect(hasFullRecordingAccess({ scope: "authority", profile: null })).toBe(true);
  });

  it("admin account hears every recording", () => {
    expect(hasFullRecordingAccess({ scope: "authority", profile: { role: "admin" } })).toBe(true);
  });

  it("agent with Executive HQ viewing access must own the lead", () => {
    expect(hasFullRecordingAccess({ scope: "authority", profile: { role: "agent" } })).toBe(false);
  });

  it("plain agent and team leader must own the lead", () => {
    expect(hasFullRecordingAccess({ scope: "agent", profile: { role: "agent" } })).toBe(false);
    expect(hasFullRecordingAccess({ scope: "coordinator", profile: { role: "team_leader" } })).toBe(false);
  });
});
