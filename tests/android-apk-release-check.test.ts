import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Runs the real CI gate script against stub aapt2/apksigner tools so every
// release rule is exercised without the Android SDK.
const SCRIPT = join(process.cwd(), "scripts/verify-android-apk.sh");
const COMPANY = "a".repeat(64);
const OTHER = "b".repeat(64);

type Stub = { pkg?: string; vcode?: string; vname?: string; cert?: string; dn?: string; signers?: number; v2?: boolean; badging?: string };

function run(flavor: "release" | "test", stub: Stub, opts: { expected?: string; prevInfo?: string; gradle?: string } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "apkgate-"));
  const apk = join(dir, "app.apk");
  writeFileSync(apk, "fake apk bytes");
  const gradle = join(dir, "build.gradle.kts");
  writeFileSync(gradle, opts.gradle ?? '    defaultConfig {\n        versionCode = 33\n        versionName = "2.22"\n    }\n');
  const pkg = stub.pkg ?? (flavor === "release" ? "com.winstone.connect" : "com.winstone.connect.test");
  const vname = stub.vname ?? (flavor === "release" ? "2.22" : "2.22-test");
  const badging = stub.badging ?? `package: name='${pkg}' versionCode='${stub.vcode ?? "33"}' versionName='${vname}' platformBuildVersionName='15' platformBuildVersionCode='35' compileSdkVersion='35' compileSdkVersionCodename='15'`;
  writeFileSync(join(dir, "aapt2"), `#!/bin/sh\ncat <<'EOF'\n${badging}\nEOF\n`);
  const signerLines = Array.from({ length: stub.signers ?? 1 }, (_, i) =>
    `Signer #${i + 1} certificate DN: ${stub.dn ?? "CN=Winstone Properties, O=Winstone"}\nSigner #${i + 1} certificate SHA-256 digest: ${stub.cert ?? COMPANY}`,
  ).join("\n");
  writeFileSync(join(dir, "apksigner"), `#!/bin/sh\ncat <<'EOF'\nVerifies\nVerified using v1 scheme (JAR signing): false\nVerified using v2 scheme (APK Signature Scheme v2): ${stub.v2 === false ? "false" : "true"}\nVerified using v3 scheme (APK Signature Scheme v3): false\nNumber of signers: 1\n${signerLines}\nEOF\n`);
  chmodSync(join(dir, "aapt2"), 0o755);
  chmodSync(join(dir, "apksigner"), 0o755);
  const args = [SCRIPT, "--apk", apk, "--flavor", flavor, "--gradle", gradle, "--version-name", "2.22", "--version-code", "33", "--report", join(dir, "report.txt")];
  if (opts.expected !== undefined) args.push("--expected-cert", opts.expected);
  if (opts.prevInfo !== undefined) {
    writeFileSync(join(dir, "prev.txt"), opts.prevInfo);
    args.push("--previous-info", join(dir, "prev.txt"));
  }
  try {
    const out = execFileSync("bash", args, { env: { PATH: process.env.PATH ?? "", BUILD_TOOLS_DIR: dir }, encoding: "utf8", stdio: "pipe" });
    return { ok: true, out, dir, apk };
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string };
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}`, dir, apk };
  }
}

describe("Android APK release check", () => {
  it("passes a release signed by the company key and writes a verifiable checksum", () => {
    const r = run("release", {}, { expected: COMPANY.toUpperCase().match(/.{2}/g)!.join(":") });
    expect(r.ok).toBe(true);
    const line = readFileSync(`${r.apk}.sha256`, "utf8").trim();
    expect(line).toMatch(/^[0-9a-f]{64} {2}app\.apk$/);
    execFileSync("sha256sum", ["-c", "app.apk.sha256"], { cwd: r.dir });
    expect(readFileSync(join(r.dir, "report.txt"), "utf8")).toContain(`signer_sha256: ${COMPANY}`);
  });

  it("refuses a release signed by a different key", () => {
    const r = run("release", { cert: OTHER }, { expected: COMPANY });
    expect(r.ok).toBe(false);
    expect(r.out).toContain("does not match");
    expect(existsSync(`${r.apk}.sha256`)).toBe(false);
  });

  it("refuses a release when no company fingerprint is configured", () => {
    expect(run("release", {}, { expected: "" }).out).toContain("WINSTONE_RELEASE_CERT_SHA256");
  });

  it("refuses a release signed with the Android debug key", () => {
    const r = run("release", { dn: "C=US, O=Android, CN=Android Debug" }, { expected: COMPANY });
    expect(r.ok).toBe(false);
    expect(r.out).toContain("debug key");
  });

  it("refuses more than one signer", () => {
    expect(run("release", { signers: 2 }, { expected: COMPANY }).out).toContain("exactly one signer");
  });

  it("refuses an APK without v2/v3 signing", () => {
    expect(run("release", { v2: false }, { expected: COMPANY }).ok).toBe(false);
  });

  it("refuses an APK whose version code differs from 33", () => {
    expect(run("release", { vcode: "32" }, { expected: COMPANY }).out).toContain("versionCode is '32'");
  });

  it("refuses an APK whose version name differs from 2.22", () => {
    expect(run("release", { vname: "2.21" }, { expected: COMPANY }).out).toContain("versionName is '2.21'");
  });

  it("refuses when the source does not declare the expected version", () => {
    const r = run("release", {}, { expected: COMPANY, gradle: 'versionCode = 32\nversionName = "2.21"\n' });
    expect(r.out).toContain("does not declare");
  });

  it("refuses the wrong package id", () => {
    expect(run("release", { pkg: "com.winstone.connect.test" }, { expected: COMPANY }).out).toContain("expected 'com.winstone.connect'");
  });

  it("test build must keep the previous test signer so agents can update in place", () => {
    expect(run("test", { cert: OTHER }, { prevInfo: `signer_sha256: ${COMPANY}\n` }).ok).toBe(false);
    expect(run("test", { cert: COMPANY }, { prevInfo: `signer_sha256: ${COMPANY}\n` }).ok).toBe(true);
  });

  it("first test build with no earlier record is recorded, not refused", () => {
    const r = run("test", { cert: OTHER, dn: "CN=Android Debug" });
    expect(r.ok).toBe(true);
    expect(r.out).toContain("first recorded test fingerprint");
  });
});

describe("Android workflows gate publishing behind the check", () => {
  for (const file of [".github/workflows/android-apk.yml", ".github/workflows/android-release.yml"]) {
    it(`${file} runs the release check before any upload or publish`, () => {
      const y = readFileSync(join(process.cwd(), file), "utf8");
      const lines = y.split("\n");
      const gateLines = lines.flatMap((l, i) => (l.includes("verify-android-apk.sh --apk") ? [i] : []));
      expect(gateLines.length).toBeGreaterThan(0);
      const publishLines = lines.flatMap((l, i) =>
        /actions\/upload-artifact|git push|gh release (create|upload)/.test(l) ? [i] : [],
      );
      expect(publishLines.length).toBeGreaterThan(0);
      // Each publish line must come after a gate line within the same job.
      const jobStarts = lines.flatMap((l, i) => (/^ {2}[a-z][\w-]*:\s*$/.test(l) ? [i] : []));
      const jobOf = (i: number) => jobStarts.filter((s) => s <= i).pop();
      for (const p of publishLines) {
        expect(gateLines.some((g) => g < p && jobOf(g) === jobOf(p))).toBe(true);
      }
    });
  }

  // Verbatim shape of `aapt2 dump badging` from the GitHub build tools (first lines). The
  // 2026-10-31 CI run failed with "package is '15'" because a greedy parser matched
  // compileSdkVersionCodename='15'; these pin the anchored parser to the real layout.
  const REAL_BADGING = (pkg: string, vname: string) => [
    `package: name='${pkg}' versionCode='33' versionName='${vname}' platformBuildVersionName='15' platformBuildVersionCode='35' compileSdkVersion='35' compileSdkVersionCodename='15'`,
    "minSdkVersion:'26'",
    "targetSdkVersion:'35'",
    "uses-permission: name='android.permission.READ_CALL_LOG'",
    "uses-permission: name='android.permission.READ_PHONE_STATE'",
    "application-label:'WINSTONE Connect'",
    "application: label='WINSTONE Connect' icon='res/mipmap-anydpi-v26/ic_launcher.xml'",
    "launchable-activity: name='com.winstone.connect.MainActivity'  label='' icon=''",
  ].join("\n");

  it("reads package and version from realistic multi-line aapt2 output (test build)", () => {
    const r = run("test", { badging: REAL_BADGING("com.winstone.connect.test", "2.22-test") }, { expected: COMPANY });
    expect(r.ok).toBe(true);
    const report = readFileSync(join(r.dir, "report.txt"), "utf8");
    expect(report).toContain("package: com.winstone.connect.test");
    expect(report).toContain("version: 2.22-test (versionCode 33)");
  });

  it("refuses a test build that carries the live app ID, even with realistic aapt2 output", () => {
    const r = run("test", { badging: REAL_BADGING("com.winstone.connect", "2.22-test") }, { expected: COMPANY });
    expect(r.ok).toBe(false);
    expect(r.out).toContain("package is 'com.winstone.connect', expected 'com.winstone.connect.test'");
  });

  it("refuses when aapt2 output has no package line instead of reading another field", () => {
    const r = run("test", { badging: "compileSdkVersionCodename='15' versionCode='33' versionName='2.22-test'" }, { expected: COMPANY });
    expect(r.ok).toBe(false);
    expect(r.out).toContain("package is '', expected 'com.winstone.connect.test'");
  });
});
