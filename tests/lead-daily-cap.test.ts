import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allowedActions } from "@/lib/command-agent.server";

const dir = "drizzle/migrations";
const sql = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.includes("daily_lead_cap"))!}`, "utf8");

describe("50 leads per agent per Dhaka day — enforced in the database for every path", () => {
  it("cap is exactly 50 and the day is Asia/Dhaka", () => {
    expect(sql).toMatch(/IF n >= 50 THEN/);
    expect(sql).toMatch(/now\(\) AT TIME ZONE 'Asia\/Dhaka'\)::date/);
    expect(sql).not.toMatch(/>= (25|15)\b/);
  });
  it("trigger fires on every assignment write to leads (insert or owner change)", () => {
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OF assigned_to, assigned_agent_id ON public\.leads/);
  });
  it("counts unique leads: same lead/retry for the same agent+day does not count twice", () => {
    expect(sql).toMatch(/PRIMARY KEY \(agent_id, work_date, lead_id\)/);
    expect(sql).toMatch(/AND lead_id = NEW\.id\) THEN\s+RETURN NEW;/);
    expect(sql).toMatch(/ON CONFLICT DO NOTHING/);
  });
  it("concurrent assignments for one agent+day are serialized", () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtextextended\(owner::text \|\| ':' \|\| d::text, 0\)\)/);
  });
  it("ledger is server-only (RLS on, no client grants)", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/lead_daily_assignment_ledger TO (anon|authenticated)/);
  });
});

describe("Winstone AI cannot bypass LeadHub Nexus", () => {
  const scopes = ["authority", "coordinator", "agent"] as const;
  it.each(scopes)("%s is never offered assign/distribute actions", (scope) => {
    const acts = allowedActions({ scope, readOnly: false } as never) as string[];
    expect(acts).not.toContain("assign_leads");
    expect(acts).not.toContain("distribute_unassigned");
  });
  it("a forged assign action is refused and audited before any write", () => {
    const src = readFileSync("src/lib/command-agent.functions.ts", "utf8");
    const refuse = src.indexOf('await audit("refused_use_leadhub_nexus")');
    expect(refuse).toBeGreaterThan(0);
    expect(refuse).toBeLessThan(src.indexOf('.update({ assigned_to: agentId'));
  });
});
