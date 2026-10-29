import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const src = (p: string) => readFileSync(p, "utf8");
describe("Oct 29 access fixes", () => {
  it("record audit limits account names to returned actors for every caller", () => {
    expect(src("src/lib/crm-backup.functions.ts")).toContain('(rows ?? []).map((r) => r.actor_id)');
  });
  it("agents may only move work dates on leads they own", () => {
    expect(src("src/lib/workday.functions.ts")).toContain("owner !== me.id");
  });
  it("messenger sync decisions require the full IT PIN", () => {
    expect(src("src/lib/messenger-sync-decisions.functions.ts")).toContain('adminTokenScope(data.adminToken ?? null) !== "full"');
  });
});
describe("Oct 29 access fixes, round 2", () => {
  it("app settings require a signed-in staff caller or PIN", () => {
    expect(src("src/lib/config.functions.ts")).toContain('caller.scope === "none") throw new Error("Sign in required")');
  });
  it("Executive HQ view-only access cannot save review notes", () => {
    expect(src("src/lib/agent-contribution.functions.ts")).toContain("if (caller.readOnly) throw");
  });
});
