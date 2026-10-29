import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("sandbox denies network access and excludes production startup and receivers", () => {
  const manifest = readFileSync("android/app/src/sandbox/AndroidManifest.xml", "utf8");
  expect(manifest).toMatch(/android:name="android.permission.INTERNET" tools:node="remove"/);
  expect(manifest).toContain('android:name="android.app.Application"');
  for (const component of [".MainActivity", ".telephony.CallStateReceiver", ".telephony.OutgoingCallReceiver", ".telephony.WinstoneInCallService", "androidx.startup.InitializationProvider"]) {
    expect(manifest).toContain(`android:name="${component}" tools:node="remove"`);
  }
});