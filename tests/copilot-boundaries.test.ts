import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync("src/lib/copilot.server.ts", "utf8");

describe("Winstone AI copilot boundaries", () => {
  it("does not offer a lead-assignment tool to the model", () => {
    const tools = server.slice(server.indexOf("const TOOLS"), server.indexOf("] as const;"));
    expect(tools).not.toContain('"assign_leads"');
  });
  it("a forged assign_leads call fails closed with no lead writes", () => {
    const block = server.slice(server.indexOf('if (name === "assign_leads")'), server.indexOf("Unknown tool"));
    expect(block).toContain("mutated: false");
    expect(block).toContain("LeadHub Nexus");
    expect(server).not.toMatch(/from\("leads"\)\s*\.update/);
    expect(server).not.toContain('from("lead_assignments")');
  });
  it("labels the call-cost figure as an estimate, not a bill", () => {
    expect(server).toContain("Estimated call cost (not a bill)");
    expect(server).not.toContain("Billing — ");
  });
  it("UI renders the copilot only for IT Console (full) scope", () => {
    expect(readFileSync("src/lib/copilot.functions.ts", "utf8")).toMatch(/adminTokenScope\(data\.adminToken\) === "full"/);
    expect(readFileSync("src/components/crm/CopilotDrawer.tsx", "utf8")).toMatch(/if \(!adminToken \|\| !access\.data\?\.allowed\) return null;/);
  });
});
