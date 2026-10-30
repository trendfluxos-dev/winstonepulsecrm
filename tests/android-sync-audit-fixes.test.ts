import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { leadNotAssignedTo, leadOwnerId } from "@/lib/lead-access.server";

const src = (p: string) => readFileSync(p, "utf8");

describe("phone sync audit fixes", () => {
  it("outcome refuses unassigned and conflicting-owner leads", () => {
    expect(leadNotAssignedTo({ assigned_to: null, assigned_agent_id: null }, "a")).toBe(true);
    expect(leadNotAssignedTo({ assigned_to: "a", assigned_agent_id: "b" }, "a")).toBe(true);
    expect(leadNotAssignedTo({ assigned_to: null, assigned_agent_id: "a" }, "a")).toBe(false);
    const s = src("src/routes/api/public/ingest/outcome.ts");
    expect(s).toContain("leadNotAssignedTo(lead, caller.profile.id)");
    expect(s).not.toContain("leadHeldByOther");
  });
  it("workspace hides conflicting-owner leads", () => {
    expect(leadOwnerId({ assigned_to: "a", assigned_agent_id: "b" })).toBeNull();
    expect(src("src/routes/api/public/agent/workspace.ts")).toContain("leadOwnerId(l) === agent.id");
  });
  it("briefing gate on phone lead capture and outcome", () => {
    for (const f of ["lead", "outcome"]) expect(src(`src/routes/api/public/ingest/${f}.ts`)).toContain("requireAgentBriefing(caller.profile.id)");
  });
  it("paused phones are refused and heartbeat is awaited", () => {
    const s = src("src/lib/device-auth.server.ts");
    expect(s).toContain('(device.status ?? "active") === "active"');
    expect(s).not.toMatch(/void supabaseAdmin\s*\.from\("agent_devices"\)/);
  });
  it("daily cap counts either owner column", () => {
    expect(src("drizzle/migrations/0136_daily_cap_counts_either_owner.sql")).toContain("COALESCE(NEW.assigned_to, NEW.assigned_agent_id)");
  });
  it("phone report payload sends no temperature/grade", () => {
    const s = src("android/app/src/main/java/com/winstone/connect/data/remote/WinstoneApi.kt");
    expect(s).not.toContain('put("temperature"');
    expect(s).not.toContain('put("grade"');
  });
});
