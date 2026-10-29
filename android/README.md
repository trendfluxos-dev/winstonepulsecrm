
## Building this project

### Automatic-call checks — 2026-10-29

- Uploaded CRM archive matches all 75 current Android source files; no replacement/import was needed.
- Carrier call-log detection now runs locally without a network requirement. Existing periodic work is updated; uploads retain their own network requirement.
- Granting call-log permission retries reconciliation. Signed-out scans cannot advance the saved cursor.
- The recording analysis schedule is present and active every 15 minutes. Delivery to the callback and successful real-audio summaries still require verification; schedule presence is not proof.
- Interrupted analysis older than 15 minutes can be reclaimed by the existing atomic claim; completed recordings are not analyzed again.
- APK workflow now runs Gradle inside `android/` and collects artifacts from the matching paths. No APK was compiled here (JDK/Android SDK unavailable).
- Phone-recorder pickup still depends on the observed call-end broadcast. Recovery when Android kills the process mid-call needs persisted call identity before it can safely be added without duplicate uploads. This is not yet verified/fixed.
- Real-device checks remain required: carrier outgoing/incoming/missed calls, offline detection then one upload after reconnect, app-killed recovery, actual audible recording and transcript-grounded summary. WhatsApp VoIP detection/audio is not guaranteed by the carrier call-log path.

```bash
cp local.properties.example local.properties   # set sdk.dir
./gradlew testDebugUnitTest                    # JVM tests (call state + number rules)
./gradlew assembleRelease                      # app/build/outputs/apk/release/app-release.apk
```
Requires JDK 17 and Android SDK 35 (build-tools 35.0.0). Gradle/Android SDK are not available in
the Lovable environment, so compiling, unit-test execution and APK packaging must run in Android
Studio or CI.

The Compose desk (`ui/DeskScreen.kt`) mirrors the web `/desk`: stats row, lead queue with a Call
button, call log with AI summary + sync state, device/recording/sync status and AI coach tab.
Calls dial over the normal SIM. `CallStateReceiver` observes the call, `CallLifecycle` maps only
the states Android actually exposes, and `CallSyncQueue` pushes call state, recordings and the
mandatory report to the existing CRM endpoints with retry.

## Companion app boundaries

### SIM call controls

The optional default-phone role binds `WinstoneInCallService` to Android Telecom.
Mute/speaker state comes from `CallAudioState`; hang-up calls `Call.disconnect()`.
There is no web JavaScript bridge, external telephony provider, new CRM ingest path,
or automatic grant of the role. The agent enables it in the device status screen.
System incoming calls can be answered or rejected before CRM sign-in and during
maintenance; emergency calls are handled by Android Telecom/preloaded dialer.
Existing call-log reconciliation and mandatory CRM reports remain unchanged.
Rebuild/reinstall the APK, grant the default-phone role, and test actual handsets:
incoming answer/reject, outgoing mute/unmute, earpiece/speaker/Bluetooth, hang-up,
multiple calls, role revocation, sign-out, maintenance, and emergency dialer handoff.
No actual call or APK build is implied by source-level regression checks.

- The web CRM is the source of truth. This app never holds its own database, its own login system
  or its own copy of CRM logic.
- Sign-in uses the existing CRM credentials endpoint and receives a per-device token bound to the
  agent profile. No service key, AI key or shared secret is compiled into the APK.
- The agent sees only their own assigned leads, calls, reports and device — enforced server-side.
- Recording audio is uploaded to the private `call-audio` storage through the existing ingest
  contract and is only ever read back through short-lived signed links.
- HQ/IT can revoke this phone at any time; the next request fails and the app signs out with a
  clear message.

## Call state mapping (what Android really tells us)

| Android PHONE_STATE | Outgoing call | Incoming call |
| --- | --- | --- |
| (agent taps CALL) | initiated | — |
| RINGING | not exposed → unknown | ringing |
| OFFHOOK | answered | answered |
| IDLE after OFFHOOK | completed | completed |
| IDLE without OFFHOOK | cancelled (sent as no_answer) | missed (sent as no_answer) |

Answered is never inferred from the agent pressing CALL. States we cannot observe are not sent.

## Recording: honest limitations

Universal two-sided SIM call recording on Android is NOT guaranteed and is not promised anywhere
in this app. From Android 10 onward the platform blocks call-audio capture for ordinary apps, and
many manufacturers block it entirely regardless of version or permission.

`RecordingCapability` reports one of: two-sided capture accepted, agent-side only, or unavailable
(with the technical reason and permission state). Policy in this release
(`CallLifecycle.REQUIRE_TWO_SIDED = true`): only a genuine two-sided recording is uploaded. A
microphone-only capture is deleted and the call is reported as recording unavailable rather than
stored as if it were a call recording. A call is never marked as recorded without a real uploaded
file, and the mandatory report always proceeds regardless of recording outcome.

## Mandatory report and lead locking

When a call ends, the report is opened server-side through the existing contract and queued, so a
dead network cannot swallow it. The CRM refuses to start the next call while a report is pending,
so the lock is enforced by the backend, not just the UI.

## Offline behaviour

Everything the phone must push (call state, recording, report open, outcome) goes through
WorkManager with exponential backoff and a unique work name per item, so retries after signal
loss, app kill or reboot can never create a second call, recording or report. The status screen
shows how many items are still waiting, how many failed, the last successful sync time and the
last error. No phone numbers, audio paths, transcripts or tokens are written to debug logs.

## Mandatory real-handset UAT checklist

### Offline short-rejection UI regression

`app/src/androidTest/java/com/winstone/connect/ui/ShortRejectionReportUiTest.kt`
opens the actual native `ReportSheet` with a synthetic connected three-second call.
It tests Not Interested, Wrong Number, Fake, normal Interested, confirmed/cancelled
outcome corrections, stale sales inputs and non-connected rejection refusal.
It requires absent qualification/grade/redundant-reason/date controls and an enabled
submit button without fabricated sales facts. It never presses Submit.

Run on a connected emulator or test handset from `android/`:

```sh
./gradlew :app:connectedSandboxAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.winstone.connect.ui.ShortRejectionReportUiTest
```

Tests target only the sandbox package: no INTERNET permission, production startup,
call services or CRM polling. The form receives an injected synthetic pending-report
reader; ordinary app callers retain the existing reader and all submission gates.

Rejections immediately omit qualification/grade, required summary and duplicate
closure/follow-up fields. Call facts and an optional note remain; the payload supplies
only outcome-derived closure defaults and drops stale sales answers. Fake stays
explicit on the wire for the server's canonical wrong-number storage mapping.
Outcome correction requires confirmation and a new selection; cancellation keeps
the rejection. Normal reports retain their existing requirements. This is not handset
readiness evidence: compilation/execution require JDK 17, SDK 35 and an emulator/device.

Recording support must NOT be treated as production-ready until this passes on the actual
company-owned handsets, one row per device:

| # | Check | Pass criteria |
| --- | --- | --- |
| 1 | Android version recorded | Exact release noted in the status screen |
| 2 | Manufacturer / model recorded | Shown in status screen and device record |
| 3 | Default dialer | Stock dialer set; note any OEM dialer |
| 4 | SIM / network | Live BD SIM, voice call working |
| 5 | Permissions | Phone, microphone, notifications granted; denial handled without crash |
| 6 | Outgoing call | Dials over the normal SIM from the lead screen |
| 7 | Call state detection | answered and completed appear in the CRM |
| 8 | Cancelled call | Hang-up before answer is NOT marked answered/completed |
| 9 | Incoming call (if in scope) | ringing / answered / missed observed correctly |
| 10 | Two-sided recording availability | Capability result matches what the device really allows |
| 11 | Recording file integrity | Audio plays back fully, both sides audible, duration matches |
| 12 | Upload | Recording appears in the CRM linked to the right lead and call |
| 13 | No false positives | Unsupported device shows recording unavailable, no file stored |
| 14 | Report submission | All required fields enforced; next lead stays locked until submitted |
| 15 | Offline report | Airplane mode during submit, then reconnect: report lands exactly once |
| 16 | Retry safety | Repeated retries create no duplicate call, recording or report |
| 17 | Agent isolation | Another agent's lead cannot be opened or called |
| 18 | Signed audio access | Recording is not reachable without a signed link |
| 19 | Device revoke | After IT revokes the phone, it signs out and cannot sync |
| 20 | Battery / doze | Queued items still sync after the phone sits idle overnight |

## Debug APK in Android Studio (Pocket Call Archive features)

1. Install Android Studio (JDK 17 bundled) and SDK Platform 35 + Build-Tools 35.0.0.
2. File → Open → select the `android/` folder; let Gradle sync finish.
3. Copy `local.properties.example` to `local.properties` if Studio did not set `sdk.dir`.
4. Run `./gradlew testDebugUnitTest` (includes `CallLogClassifierTest`).
5. Build → Build Bundle(s)/APK(s) → Build APK(s), or `./gradlew assembleDebug`.
   Output: `app/build/outputs/apk/debug/app-debug.apk` (debug-signed; no release keys needed).
6. On the phone allow Phone, Call log, Notifications and (for recordings) audio/files access.

Call tracing: live `CallStateReceiver` + `CallLogSweeper` cover incoming, outgoing and missed calls
with duration. `CallLogClassifier` keeps missed / rejected / blocked distinct on the phone while
the CRM still receives the existing completed / no_answer states. Some OEMs log rejected calls as
missed. The app never starts call recording itself on Android 10+; it only picks up files the
phone's own recorder produced (no match = no upload).
