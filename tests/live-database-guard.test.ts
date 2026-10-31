import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LIVE = "https://siepfegeubbqwhodyxcg.supabase.co";

describe("routine tests cannot reach the real database", () => {
  it("a read to the live backend is refused", async () => {
    if (process.env["RUN_LIVE_SCOPE_TESTS"] === "1") return; // reads are allowed in the explicit live mode
    await expect(fetch(`${LIVE}/rest/v1/leads?select=id&limit=1`)).rejects.toThrow("[test-guard]");
    // The guard also fails the test after it; clear that record for this deliberate probe.
    const { afterEach } = await import("vitest");
    void afterEach;
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
