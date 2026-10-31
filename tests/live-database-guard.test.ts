import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LIVE = "https://siepfegeubbqwhodyxcg.supabase.co";

describe("routine tests cannot reach the real database", () => {
  it("reads and writes to the live backend are refused and recorded", async () => {
    if (process.env["RUN_LIVE_SCOPE_TESTS"] === "1") return; // explicit live mode allows reads
    const { takeBlockedRequests } = await import("./setup/block-live-database");
    await expect(fetch(`${LIVE}/rest/v1/leads?select=id&limit=1`)).rejects.toThrow("[test-guard]");
    await expect(fetch(`${LIVE}/rest/v1/leads`, { method: "POST", body: "{}" })).rejects.toThrow("[test-guard]");
    expect(takeBlockedRequests()).toEqual(["GET /rest/v1/leads", "POST /rest/v1/leads"]);
  });

  it("the guard is loaded for every routine test file", () => {
    expect(readFileSync("vitest.config.ts", "utf8")).toMatch(/setupFiles:.*block-live-database\.ts/);
  });

  it("tests that write probe rows only run against an isolated staging backend", () => {
    const src = readFileSync("tests/classification-review.integration.test.ts", "utf8");
    expect(src).toMatch(/STAGING_E2E.*=== "1"/);
    expect(src).toMatch(/!backend\.includes\("siepfegeubbqwhodyxcg"\)/);
  });

  it("live security probes are opt-in", () => {
    for (const f of ["tests/rls.test.ts", "tests/project-photo-access.test.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src).toMatch(/RUN_LIVE_SCOPE_TESTS"\] === "1"/);
      expect(src).not.toMatch(/describe\.runIf\(url && key/);
    }
  });
});
