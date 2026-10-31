# Android release readiness — single record

Agents receive a release APK only when every gate row below has evidence (who, date, link/screenshot).
Code readiness or a green CI run is never device proof.

## 1. Build ledger

| Item | Value | Evidence | Verified by / date |
|---|---|---|---|
| Repository | github.com/zhemongrowth-bd/Android-Call-recorder (public) | — | — |
| Earlier reported commits | a6938e4 (uploaded ZIP), 948177d (older debug APK) | owner report | superseded |
| Latest CI run (only artifacts kept) | 40579865289 — unit tests ✓, debug APK ✓ (16.9 MB zip), signed release APK ✓ (11.5 MB zip); older artifacts deleted | GitHub Actions log | CI 2026-10-27 |
| Release application ID | com.winstone.connect | build.gradle.kts | unverified on built APK |
| Test application ID | com.winstone.connect.test ("Winstone Pulse TEST") | build.gradle.kts | unverified on built APK |
| Version | 2.17 (28) | build.gradle.kts | unverified on built APK |
| Release signing fingerprint (SHA-256) | _fill from `apksigner verify --print-certs`_ | | ☐ |

## 1a. How to verify signature, application ID and version (no secrets needed)

Only the **public** certificate is read from the built APK. Never open, copy or paste the keystore,
its password, the GitHub secret values or `local.properties` while doing this.

1. Download `winstone-agent-release-apk` and `winstone-agent-debug-apk` from the CI run in the ledger; unzip each to get the `.apk`.
2. Use a computer with the Android SDK build-tools installed (Android Studio includes them). Find them under `<sdk>/build-tools/<version>/`.
3. **Signature** — run:
   `apksigner verify --verbose --print-certs app-release.apk`
   - Must print `Verifies` and `Verified using v2 scheme ... true`.
   - Copy only the `Signer #1 certificate SHA-256 digest` line into the ledger. This is a public fingerprint, safe to share.
   - The debug APK must show a **different** digest (Android debug key). The same digest on both = stop, wrong signing.
4. **Application ID and version** — run:
   `aapt2 dump badging app-release.apk | head -1`
   - Release must show `package: name='com.winstone.connect'` and the expected `versionCode` / `versionName`.
   - Repeat for the debug APK: must show `com.winstone.connect.test` and `versionName` ending in `-test`.
5. **On the phone (optional cross-check)** — Settings → Apps → Winstone Pulse → App details shows the version; both "Winstone Pulse" and "Winstone Pulse TEST" must be installed side by side.
6. **Every later release** must show the **same** release SHA-256 digest as recorded here; a different digest means agents cannot update in place — do not distribute.
7. Record in the ledger: digest, package name, versionCode/versionName, who checked, date. Screenshots of terminal output are fine; crop out file paths that reveal key locations.

What never goes in this file, chat or screenshots: keystore files, store/key passwords, key alias secrets, GitHub secret values.

## 1b. Automatic CI release check

`scripts/verify-android-apk.sh` runs in `android-apk.yml` (test + release jobs) and `android-release.yml` (tags)
before any APK is saved to `apk-builds`, uploaded as an artifact or attached to a GitHub Release. It fails the job when:

- `build.gradle.kts` or the built APK does not carry the expected versionName/versionCode (tag `vX.Y` must equal versionName);
- the package id is not `com.winstone.connect` (release) / `com.winstone.connect.test` (test);
- the APK is not v2/v3 signed by exactly one signer whose SHA-256 equals repository variable
  `WINSTONE_RELEASE_CERT_SHA256` (release; missing variable = fail; Android debug key = fail). Test builds must match
  `WINSTONE_TEST_CERT_SHA256` or, when unset, the previous `build-info-test.txt` signer;
- the written `<apk>.sha256` does not verify, before and after copying to `apk-builds`.

The record (`build-info-release.txt` / `build-info-test.txt`) stores package, version, signer and APK SHA-256.
A passing check is build evidence only; the device rows below still need a real phone.

## 2. Included fixes

| Fix | Status |
|---|---|
| Pocket Call Archive: call-log cursor (timestamp + row ID) | included (run 40578159123) |
| Pocket Call Archive: temp-file + size-checked recording copy | included |
| Pocket Call Archive: pickup copy cleanup after durable queue | included |
| Pocket Call Archive: retry exhaustion visible as failure | included |
| Per-recording sync status + "Retry failed uploads" | included |
| Recording filters (All/Pending/Syncing/Synced/Failed), date, duration, last error | included (run 40579865289) |
| Recording upload / CRM sync retry policy (429/5xx backoff, permanent 4xx, 401/403) | **missing — patch file not received** |

## 3. Signing decision (owner)

- Existing key: `android/winstone-release.jks` (committed in this project; used for earlier `winstone-agent-v2.3-release.apk`).
- New key: created 2026-10-27, stored only as encrypted GitHub secrets.
- Different keys ⇒ phones on v2.3 cannot update in place.
- Decision: ☐ keep existing key (move to GitHub secrets, remove from repo) ☐ keep new key (one-time uninstall on every agent phone)
- Backup location of canonical key: ________
- `android/SIGN-AND-DISTRIBUTE.md` must be updated to match the chosen method.

### Tradeoffs: old key vs new key

| | **A. Keep old key** (`android/winstone-release.jks`, signed v2.3) | **B. Switch to new key** (created 2026-10-27, GitHub secrets only) |
|---|---|---|
| Agent update | Installs over v2.3 in place; no uninstall | Every agent phone must uninstall v2.3 once, then install |
| Data on phone during switch | Kept (sign-in, queued recordings, pending reports) | Uninstall wipes app data: **queued unsynced recordings/reports on that phone are lost** unless synced first |
| Key exposure history | File has been committed in this project's source; anyone with project/code access may have a copy. Its passwords' storage history is unknown | Generated fresh, never committed; exists only encrypted in GitHub secrets (plus any backup the owner makes) |
| Work required | Move key + passwords into GitHub secrets, delete the file from the project, update `SIGN-AND-DISTRIBUTE.md`. Old copies in history remain | None in code; plan a coordinated uninstall/reinstall day and confirm every phone shows 0 pending before uninstall |
| Risk if key leaked | Someone could sign a fake "Winstone Pulse" update that agents' phones accept | Same risk, but much lower likelihood today |
| Backup/loss risk | Owner must confirm passwords are still known; lost password = cannot sign updates | No backup exists yet; if GitHub secrets are lost, updates break — owner backup needed |
| Reversibility | Can still switch to B later (same one-time uninstall) | Final for this package; cannot return to A without another uninstall |

**Safe switch procedure (B):** 1) In the CRM, confirm each agent phone has no pending/failed recordings or reports. 2) Uninstall v2.3. 3) Install new release, sign in, accept briefing. 4) Make one test call and confirm Synced. 5) Record phone + date below.

**If A is chosen:** treat the committed key as possibly exposed — only acceptable if the project code has never been shared outside the owner/IT; otherwise prefer B.

Owner decision: ☐ A ☑ **B — switch to new key** — by owner (TrendFlux OS IT) date **2026-10-28** reason: the old keystore lived in the project tree and cannot be guaranteed uncompromised; enforce the safe switch checklist; back up the new key in IT password storage.

### Encrypted backup and restore of the signing key

GitHub secrets are write-only: nobody (including Lovable) can read the current key back out. The 2026-10-27 key therefore has **no backup** and must be replaced once, before agents switch, by a key IT creates and backs up itself. Never put the key, its passwords or the backup file in this project, chat, screenshots or the public repo.

**Create (once, on an IT computer with JDK + GPG):**
1. `keytool -genkeypair -v -keystore winstone-release.jks -alias winstone -keyalg RSA -keysize 4096 -validity 10000` — choose strong store/key passwords; save both in IT password storage.
2. Encrypted backup: `gpg --symmetric --cipher-algo AES256 -o winstone-release.jks.gpg winstone-release.jks` — use a third, separate backup passphrase, saved in IT password storage.
3. Store `winstone-release.jks.gpg` in two places (e.g. IT password vault attachment + offline USB in a safe). Record the SHA-256 of the `.gpg` file: `sha256sum winstone-release.jks.gpg`.
4. Upload to GitHub → repo Settings → Secrets → Actions (overwrite): `WINSTONE_KEYSTORE_B64` = `base64 -w0 winstone-release.jks`, `WINSTONE_KEYSTORE_PASSWORD`, `WINSTONE_KEY_ALIAS`, `WINSTONE_KEY_PASSWORD`.
5. Delete the plain `winstone-release.jks` from the computer; keep only the `.gpg`.
6. Run the release build and record its SHA-256 certificate fingerprint (section 1). This fingerprint is the canonical one; every future release must match it.

**Restore (lost GitHub secrets, new CI, new laptop):**
1. Get `winstone-release.jks.gpg` from backup; check `sha256sum` matches the recorded value.
2. `gpg -d -o winstone-release.jks winstone-release.jks.gpg` (backup passphrase).
3. Check: `keytool -list -v -keystore winstone-release.jks` — SHA-256 must equal the canonical fingerprint. Different = wrong key, stop.
4. Re-enter the four GitHub secrets (step 4 above) or `local.properties` `RELEASE_*` for a local build; build; verify the APK fingerprint again; delete the plain `.jks`.

**Annual check:** IT decrypts the backup on an offline machine, confirms the fingerprint, deletes the plain copy, and records the date.

| Item | Value |
|---|---|
| Canonical fingerprint (SHA-256) | ________ |
| `.gpg` file SHA-256 | ________ |
| Backup locations (names only, no secrets) | ________ |
| Created by / date | ________ |
| Last restore test | ________ |

## 4. Device results — Proton HyperX, Android 16

Run `android/DEVICE_TEST_CHECKLIST.md`, plus:

| Check | Result | Evidence |
|---|---|---|
| Install release + test side by side | ☐ | |
| Signature / app ID / version match ledger | ☐ | |
| Outgoing call logged correctly | ☐ | |
| Incoming call logged correctly | ☐ | |
| Missed / rejected never "completed" | ☐ | |
| Phone-recorder pickup uploads matching audio | ☐ | |
| Offline + reboot → uploads once on reconnect | ☐ | |
| CRM acknowledgement before original deleted | ☐ | |
| No duplicate upload on retry | ☐ | |
| Server 429 / 500 → retried with backoff | ☐ (needs retry-policy patch) | |
| Server 401 → failure kept, resend after re-login | ☐ (needs retry-policy patch) | |
| Interrupted upload recovers | ☐ | |
| Recording attributed to the calling agent only (cross-agent) | ☐ | |

## 5. Release gate

☐ Sections 1–4 complete with evidence → share release APK with one agent → repeat outgoing call + recording → share with all agents.

### Build 2026-10-28 — audit fixes (commit 51d820c, run 40583215365)
- Unit tests: passed in CI. Debug + signed release APK built. Release artifact 1.7 MB (R8 shrinking on; was 11.5 MB).
- Not yet verified: fingerprint/app ID/version (section 1a), on-device run of the minified release.
