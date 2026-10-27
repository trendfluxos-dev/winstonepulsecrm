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
