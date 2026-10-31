import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The newest migration defining leads_work_state_check is the live rule. */
function allowedWorkStates(): string[] {
  const dir = "drizzle/migrations";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let last = "";
  for (const f of files) {
    const sql = readFileSync(`${dir}/${f}`, "utf8");
    const m = sql.match(/ADD CONSTRAINT leads_work_state_check[\s\S]*?CHECK\s*\(([\s\S]*?)\);/);
    if (m) last = m[1]!;
  }
  return [...last.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!);
}

describe("leads.work_state database rule matches what reports write", () => {
  it("allows the No Answer cadence states snoozed and unresponsive", () => {
    expect(allowedWorkStates()).toEqual(
      expect.arrayContaining(["pending", "completed", "duplicate_skipped", "snoozed", "unresponsive"]),
    );
  });

  it("every work_state the report finalizer can write is allowed", () => {
    const src = readFileSync("src/lib/call-reports.server.ts", "utf8");
    const written = new Set<string>();
    for (const m of src.matchAll(/work_state:\s*([^,\n}]+)/g)) {
      for (const lit of m[1]!.matchAll(/"([a-z_]+)"/g)) written.add(lit[1]!);
    }
    expect(written.size).toBeGreaterThan(0);
    const allowed = allowedWorkStates();
    for (const s of written) expect(allowed).toContain(s);
  });
});
