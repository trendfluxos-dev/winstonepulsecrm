import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const root = "android/app/src/main/java/com/winstone/connect/";
describe("automatic carrier-call wiring regression guards", () => {
  it("offline detection does not wait for the upload network constraint", () => {
    const worker = readFileSync(root + "data/sync/CallLogSweepWorker.kt", "utf8");
    expect(worker).not.toContain("setRequiredNetworkType");
    expect(worker).toContain("ExistingPeriodicWorkPolicy.UPDATE");
    expect(worker).toContain("15, TimeUnit.MINUTES");
  });
  it("signed-out resume cannot consume the call-log cursor", () => {
    const sweep = readFileSync(root + "telephony/CallLogSweeper.kt", "utf8");
    expect(sweep.indexOf("AgentSession.employeeIdNow(context) == null")).toBeGreaterThan(0);
    expect(sweep.indexOf("AgentSession.employeeIdNow(context) == null")).toBeLessThan(sweep.indexOf("val prefs ="));
  });
  it("granting call-log access retries local reconciliation", () => {
    const main = readFileSync(root + "MainActivity.kt", "utf8");
    const callback = main.slice(main.indexOf("override fun onRequestPermissionsResult"));
    expect(callback).toContain("grantResults.getOrNull(logIndex) == PackageManager.PERMISSION_GRANTED");
    expect(callback).toContain("CallLogSweeper.sweep(applicationContext)");
  });
});