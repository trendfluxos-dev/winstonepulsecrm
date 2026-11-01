import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";

type Step = { name?: string; uses?: string; if?: string; id?: string; run?: string; "continue-on-error"?: boolean; env?: Record<string, string> };
type Wf = { jobs: Record<string, { steps: Step[] }> };
const load = (f: string) => yaml.load(readFileSync(f, "utf8")) as Wf;
const apk = load(".github/workflows/android-apk.yml");
const tagged = load(".github/workflows/android-release.yml");
const release = apk.jobs.release.steps;

describe("official Android release gates", () => {
  it("requires all four signing secrets and the approved fingerprint variable", () => {
    const gate = release[0];
    for (const k of ["WINSTONE_KEYSTORE_B64", "WINSTONE_KEYSTORE_PASSWORD", "WINSTONE_KEY_ALIAS", "WINSTONE_KEY_PASSWORD"])
      expect(Object.values(gate.env ?? {})).toContain(`\${{ secrets.${k} }}`);
    expect(Object.values(gate.env ?? {})).toContain("${{ vars.WINSTONE_RELEASE_CERT_SHA256 }}");
    const tg = tagged.jobs.release.steps[0];
    expect(Object.values(tg.env ?? {})).toContain("${{ vars.WINSTONE_RELEASE_CERT_SHA256 }}");
    expect(tg.run).toContain("exit 1");
  });

  it("refuses a build when signing material is committed, before building", () => {
    const refuse = release.findIndex((s) => s.name === "Refuse committed signing material");
    const build = release.findIndex((s) => s.name === "Build signed release APK");
    expect(refuse).toBeGreaterThan(-1);
    expect(refuse).toBeLessThan(build);
  });

  it("verifies package com.winstone.connect and fails on fingerprint mismatch", () => {
    const v = release.find((s) => s.name?.startsWith("Verify signer fingerprint"))!;
    expect(v.run).toContain("name='com.winstone.connect'");
    expect(v.run).toContain("Signer fingerprint mismatch");
  });

  it("treats artifact-storage failure separately from a build failure", () => {
    for (const steps of [apk.jobs.debug.steps, release, tagged.jobs.release.steps]) {
      const up = steps.find((s) => s.uses?.startsWith("actions/upload-artifact"))!;
      expect(up["continue-on-error"]).toBe(true);
      expect(steps.some((s) => s.name === "Report artifact upload result")).toBe(true);
    }
  });

  it("writes a SHA-256 checksum file next to every APK", () => {
    expect(apk.jobs.debug.steps.some((s) => s.run?.includes('.sha256"'))).toBe(true);
    expect(release.some((s) => s.run?.includes('.sha256"'))).toBe(true);
  });

  it("tagged release only creates a draft, never publishes or overwrites", () => {
    const pub = tagged.jobs.release.steps.find((s) => s.run?.includes("gh release"))!;
    expect(pub.run).toContain("--draft");
    expect(pub.run).not.toContain("--clobber");
  });
});

describe("Android CI check (build + tests, no signing)", () => {
  const raw = readFileSync(".github/workflows/android-ci.yml", "utf8");
  const ci = yaml.load(raw) as Wf & { on: Record<string, unknown>; permissions: Record<string, string> };
  const steps = ci.jobs["build-and-test"].steps;
  it("runs on pull requests and is read-only", () => {
    expect(Object.keys(ci.on)).toContain("pull_request");
    expect(ci.permissions).toEqual({ contents: "read" });
  });
  it("runs the full unit-test suite and builds unsigned APKs", () => {
    expect(steps.some((s) => s.run?.includes("./gradlew --no-daemon test assembleDebug assembleSandbox"))).toBe(true);
  });
  it("never touches signing secrets, release builds, pushes or releases", () => {
    expect(raw).not.toMatch(/secrets\./);
    expect(raw).not.toMatch(/assembleRelease|bundleRelease|gh release|git push/);
  });
});
