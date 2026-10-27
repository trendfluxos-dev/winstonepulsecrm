import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("workspace role terminology", () => {
  it("entry page never writes the wrong singular 'Headquarter' and has no 'ask-anything' surface", () => {
    const s = read("src/routes/index.tsx");
    expect(s).not.toMatch(/Headquarter(?!s)/);
    expect(s).not.toContain("ask-anything");
  });
  it("Winstone AI copilot instructions do not assign dispatch or billing ownership to HQ", () => {
    const s = read("src/lib/copilot.server.ts");
    const system = s.slice(s.indexOf("const SYSTEM"), s.indexOf("`;", s.indexOf("const SYSTEM")));
    expect(system).not.toMatch(/HQ authority/);
    expect(system).toContain("IT Console sessions only");
    expect(system).toContain("LeadHub Nexus owns the canonical lead database");
  });
  it("copilot server still requires the IT Console (full) PIN, matching its label", () => {
    expect(read("src/lib/copilot.functions.ts")).toMatch(/requireAdminToken\(data\.adminToken\)/);
    expect(read("src/lib/admin-gate.server.ts")).toMatch(/adminTokenScope\(token\) !== "full"/);
  });
});
