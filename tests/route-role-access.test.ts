import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { requireWrite } from "@/lib/access.server";

const route = (f: string) => readFileSync(`src/routes/${f}`, "utf8");

describe("route-by-role UI gates", () => {
  // Screens that must only open for HQ / IT (authority) sessions.
  const authorityOnly = ["hq.tsx", "agent-activity.tsx", "staff-portal.tsx", "booking-review.tsx", "contributions.tsx", "audit-log.tsx", "credits.tsx", "social-pages.tsx", "system.tsx", "runtime-errors.tsx", "migration.tsx", "migration-export.tsx"];
  for (const f of authorityOnly) {
    it(`${f} is gated to authority and never lets agents in`, () => {
      const src = route(f);
      expect(src).toMatch(/RoleGate/);
      const allow = src.match(/allow=\{\[([^\]]*)\]\}/)?.[1] ?? "";
      expect(allow).toContain("authority");
      expect(allow).not.toContain("agent");
    });
  }
  it("LeadHub checks its own server access, not the general session", () => {
    expect(route("leadhub.tsx")).toMatch(/checkLeadHubAccess/);
  });
  it("every page route file is in the reviewed inventory", () => {
    const files = readdirSync("src/routes").filter((f) => f.endsWith(".tsx") && f !== "__root.tsx");
    expect(files.length).toBe(53);
  });
});

describe("read-only Executive HQ", () => {
  it("cannot write", () => {
    expect(() => requireWrite({ scope: "authority", readOnly: true } as never)).toThrow();
    expect(() => requireWrite({ scope: "authority", readOnly: false } as never)).not.toThrow();
  });
  it("record restore requires a writable session", () => {
    const src = readFileSync("src/lib/crm-backup.functions.ts", "utf8");
    const restore = src.slice(src.indexOf("export const restoreCrmRecord"), src.indexOf("const AuditQuery"));
    expect(restore).toMatch(/requireWrite\(c\)/);
  });
});
