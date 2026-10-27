# Android build and release readiness: findings and tracking plan

## Findings (inspection only, nothing changed)

1. **The pasted report is out of date.** After commits a6938e4 and 948177d, more work went to the GitHub repository in this chat. The latest run (40578159123) built the current source on GitHub: unit tests passed, the debug APK built and a signed release APK built. "Current source could not be built" no longer applies.
2. **What that run includes:**
   - Pocket Call Archive fixes: call-log cursor, safe recording copy, pickup cleanup and visible retry exhaustion
   - Per-recording sync status and the "Retry failed uploads" button
   - Release signing from encrypted repository secrets
   - Debug build renamed to `com.winstone.connect.test` / "Winstone Pulse TEST", so it installs beside the release
3. **Not included yet:** the "recording upload and CRM sync" retry-policy patch (429/5xx backoff, permanent 4xx, 401/403). Its file was never uploaded.
4. **Still unverified:**
   - APK signature fingerprint, application ID and version, read from the built files
   - Installation on Proton HyperX (Android 16)
   - All on-device behaviour: incoming/outgoing/missed calls, recording pickup, offline retry, CRM acknowledgement, duplicate uploads and cross-agent attribution
5. **Signing-key conflict (important):**
   - The project already contains an older keystore, `android/winstone-release.jks`.
   - There was also an earlier agent release, `winstone-agent-v2.3-release.apk`.
   - The new GitHub release is signed with a different, newly created key.
   - Phones running v2.3 will not accept the new build as an update; agents would have to uninstall first.
   - `android/SIGN-AND-DISTRIBUTE.md` still describes the old local signing method, which no longer matches `app/build.gradle.kts`.
6. **Security note:** a keystore file is committed in the project tree. It should leave source control once the owner confirms which key is canonical.
7. **Existing tracking:** `roadmap.md` already holds Android items, including open items at lines 277, 299 and 345–346 that Java/SDK blocked. There is no single release-readiness record.

## Proposal: where to track it

Create **`docs/ANDROID_RELEASE_READINESS.md`** as the one release-readiness record, next to the existing verification docs (for example `docs/hq-release-live-check-2026-10-18.md`). It would contain:
- A build ledger: commit, workflow run, tests, debug and release artifacts, signing fingerprint, application ID, version. Each row has a "verified by / date" column; nothing counts as verified without evidence.
- An included-fixes table: Pocket Call Archive fixes (included), retry-policy patch (missing), status and retry UI (included).
- Device results that link to `android/DEVICE_TEST_CHECKLIST.md`, extended with the report's extra checks: 429/500/401 responses, interrupted upload, re-login resend, cross-agent attribution and Android 16 on Proton HyperX.
- A signing decision section: which key is canonical, the v2.3 upgrade path and where the backup key is stored.
- A release gate: agents get the release APK only after every row is evidenced.

Also:
- Add one roadmap item pointing to this doc, and collapse the scattered open Android items into it.
- Add one `AGENTS.md` rule: an Android release counts as ready only when this doc records the device evidence, mirroring the existing live-release rule.

## Decisions needed from the owner before implementation

- **Canonical signing key:** keep the existing project keystore so v2.3 phones can upgrade in place (move it into GitHub secrets, remove it from the repo), or keep the new key and accept a one-time uninstall.
- **Retry-policy patch:** upload the file so it can be reviewed and added.

## Out of scope for this plan

No code changes, builds, workflow runs, deployments or production data changes. Approving the plan only creates the tracking doc and the roadmap and AGENTS.md entries.
