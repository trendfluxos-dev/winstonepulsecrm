import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = (p: string) =>
  readFileSync(`android/app/src/main/java/com/winstone/connect/${p}`, "utf8");

describe("Android recording consent gate", () => {
  const receiver = src("telephony/CallStateReceiver.kt");
  const pickup = src("data/sync/PhoneRecordingPickupWorker.kt");
  const main = src("MainActivity.kt");

  it("never starts the app recorder without the agent's consent", () => {
    expect(receiver).toMatch(/val consented = RecordingConsent\.granted\(app, employeeId\)/);
    expect(receiver).toMatch(/val started = consented && rec\.start\(/);
  });

  it("never uploads or picks up phone-recorder audio without consent", () => {
    expect(receiver).toMatch(/uploadable\(support, captured != null\) &&\s*RecordingConsent\.granted\(app, employeeId\)/);
    expect(receiver).toMatch(/!\(captured != null && uploadable\) && RecordingConsent\.granted\(app, employeeId\)/);
    // Re-checked inside the worker so a withdrawal after the call still stops the upload.
    const doWork = pickup.slice(pickup.indexOf("override suspend fun doWork"));
    expect(doWork.indexOf("RecordingConsent.granted")).toBeGreaterThan(-1);
    expect(doWork.indexOf("RecordingConsent.granted")).toBeLessThan(doWork.indexOf("query(ctx"));
  });

  it("asks microphone/audio-file permission only after consent", () => {
    const perms = src("telephony/AppPermissions.kt");
    const initial = main.slice(main.indexOf("private fun requestCallPermissions"), main.indexOf("private fun requestAudioPermissions"));
    expect(initial.length).toBeGreaterThan(0);
    expect(initial).not.toMatch(/Manifest\.permission\.RECORD_AUDIO/);
    expect(initial).toMatch(/AppPermissions\.wantedNow\(/);
    // The only place audio permissions enter the request list is behind the consent flag.
    const wanted = perms.slice(perms.indexOf("fun wanted("), perms.indexOf("fun toRequest("));
    const gate = wanted.indexOf("if (consented)");
    expect(gate).toBeGreaterThan(-1);
    expect(wanted.indexOf("RECORD_AUDIO")).toBeGreaterThan(gate);
    expect(wanted.indexOf("READ_MEDIA_AUDIO")).toBeGreaterThan(gate);
    expect(perms).toMatch(/wanted\(Build\.VERSION\.SDK_INT, RecordingConsent\.granted\(context, employeeId\)\)/);
    expect(main).toMatch(/RecordingConsentScreen\(/);
  });
});
