# Winstone Pulse Agent App — Internal Release Handover and Operational Sign-off

**Scope: internal company distribution only.** Winstone Pulse Android is a private internal tool for
Winstone's own agents. It is **not** published to Google Play or any public store, and no store listing,
store review or store signing service is required. The goal is an internally signed, installable APK that
uses the same production CRM backend, data and business rules as the web CRM.

**Internal operational sign-off: NOT READY** (status as of 2026-11-01, 15:51 Dhaka).
The three gates in section F are technical, internal checks — not app-store gates.
This document is the handover sequence. Supporting detail stays in:
`docs/ANDROID_RELEASE_READINESS.md` (key backup/restore, ledger), `docs/ANDROID_DEVICE_ACCEPTANCE.md`
(device checklist), `docs/ANDROID_CRM_CONSISTENCY_AUDIT.md` (Android ↔ web CRM data/call-time audit),
`.github/workflows/android-apk.yml` and `android-release.yml` (the build gate; a tag creates only a private
draft release inside the company repository), `tests/android-release-gates.test.ts` (guards the gate rules).

| Fixed identity | Value |
|---|---|
| Repository / branch | `trendfluxos-dev/winstone-pulse-crm` (private) / `main` |
| Release applicationId | `com.winstone.connect` (test build `com.winstone.connect.test` is never official) |
| Version | `versionName 2.21`, `versionCode 32` (`android/app/build.gradle.kts`) |
| Live CRM (same backend the APK uses) | https://crm.winstonebd.com |
| Distribution | internal only: IT shares the verified APK + `.sha256` directly with company agent phones |

Never put keystore files, passwords, alias values, secret values or `local.properties` in chat, logs,
screenshots, tickets or this repository. Only the **public** certificate SHA-256 fingerprint may be written down.

---

## A. Company Signing Key Owner — GitHub encrypted secrets

Where: GitHub → `trendfluxos-dev/winstone-pulse-crm` → Settings → Secrets and variables → Actions → **Secrets**.

| Secret name | Content |
|---|---|
| `WINSTONE_KEYSTORE_B64` | the company keystore, base64 on one line (`base64 -w0 <keystore>`) |
| `WINSTONE_KEYSTORE_PASSWORD` | keystore password |
| `WINSTONE_KEY_ALIAS` | key alias |
| `WINSTONE_KEY_PASSWORD` | key password |

1. Work on a trusted IT computer. Use only the company key from its encrypted backup (readiness doc, section 3 "Restore").
2. Paste each value directly into GitHub's secret form. Do not echo it in a terminal that is recorded or shared.
3. Delete any plain decoded keystore copy afterwards; keep only the encrypted backup.
4. Never use `android/winstone-release.jks` (committed in project history; retired and untrusted by owner decision B, 2026-10-28) or any key that was ever committed, emailed or pasted in chat.
5. Lovable/AI agents and IT staff without key custody must not generate, rotate, choose or upload a key on the company's behalf.

Done when: GitHub lists all four names (values are never shown). Record name presence only in the sign-off table.

## B. Company Signing Key Owner + IT Admin — approved certificate fingerprint

Presence of the four secrets is **not** enough: the build fails unless the signer equals the approved fingerprint.

1. Key owner reads the fingerprint from the restored company key on the offline computer:
   `keytool -list -v -keystore <keystore> -alias <alias>` → copy the `SHA256:` line only.
2. IT Admin independently confirms it against a second trusted record (the fingerprint recorded at key creation in the
   readiness doc section 3 table, or the signer of the last officially distributed APK via `apksigner verify --print-certs`).
   If the two disagree or no trusted record exists → **STOP**; do not pick one.
3. Set repository **variable** (not secret) `WINSTONE_RELEASE_CERT_SHA256` = that fingerprint
   (Settings → Secrets and variables → Actions → **Variables**). Colons and case are ignored by the gate.
4. Write the same public fingerprint into the readiness doc section 3 "Canonical fingerprint" row.

Done when: variable exists, two people confirmed the value from independent trusted evidence.

## C. Lovable Project Owner — sync the EXISTING repository

Do not change repository, branch or history, and never force-push.

1. Lovable → this project → Project settings → **Git**. Confirm it shows `trendfluxos-dev/winstone-pulse-crm`, branch `main`.
2. If it shows connected but behind: push any small commit to `main` from a local clone (normal push), which makes Lovable sync.
   If it reports "diverged": merge the newest `lovable-sync*` branch into `main` on GitHub (pull request, normal merge).
3. If it shows **disconnected**: Lovable cannot re-link an existing repository — reconnecting always creates a new one.
   **Stop and decide with IT** before reconnecting, because secrets (A) and the variable (B) would then have to be set on the new repository.
4. Confirm sync: the newest commit on GitHub `main` (Code → commits) must match the newest change in Lovable's history,
   and `android/app/build.gradle.kts` on GitHub must show the expected version.

Status 2026-11-01: GitHub `main` = `e181c951` (2026-10-31 04:38 UTC); Lovable is ahead at `f2e56ab8` (2026-11-01 09:24 UTC) → **stale**.

## D. IT Admin — build and verify the official signed APK

Start only when A, B and C are Done.

1. GitHub → Actions → **Android APKs** → Run workflow on `main` (or push a tag `v2.21` for **Android tagged release**, which only makes a **draft** release).
2. The release job blocks (names only, no values) when any secret or the variable is missing, and refuses to build if any keystore file is tracked in the repository.
3. Required log evidence (job `release`):
   - `apksigner` signer SHA-256 equals `WINSTONE_RELEASE_CERT_SHA256` (else "Signer fingerprint mismatch" → STOP).
   - `aapt2` shows `name='com.winstone.connect'`, `versionCode='32'`, `versionName='2.21'`.
   - `.sha256` file printed; job summary says "Official release APK verified".
4. Download the APK and `.sha256` from the `apk-builds` branch (`build-info-release.txt`) or the artifact / draft release.
   Run `sha256sum -c <apk>.sha256` → `OK`.
5. Reading the result:
   - **Warning only** "artifact copy NOT uploaded (usually storage quota)" = build is good; use the `apk-builds` branch / draft release copy.
   - Any red step in build, signing, fingerprint, package or version checks = **real failure**; nothing is official.
   - `Official release: BLOCKED — missing: …` = A/B not done; nothing was signed.
6. A file named `*-debug*`, `*-test*` or package `com.winstone.connect.test` is **never** the official APK.

## E. Agent Tester — real Android phone test

Use `docs/ANDROID_DEVICE_ACCEPTANCE.md` (24 rows). Record for the run: phone model, Android version, test time (Dhaka),
staff test account (no password), APK SHA-256, and evidence links. Use test leads and a second phone you control;
no real customer data without written authorization.

Must cover: install and update-in-place, incoming call, outgoing call, missed/unanswered call (never "connected", FAKE LEAD blocked),
recording consent/permission/availability and phone-recorder pickup, call-log evidence vs CRM rows,
CRM sync including offline + reboot, report submission, duplicate prevention (each call/report once),
and diagnostics (Desk sync status, failed/retry states, IT load diagnostics if errors appear).

## F. Internal operational sign-off (not a Play Store gate)

The sign-off stays **NOT READY** until all three rows below are **Pass** with evidence. Any Fail → do not hand the APK
to agents. Passing means only: IT may install the APK on company agent phones (internal company distribution only).

| # | Gate | Owner | Evidence required | Status | Date (Dhaka) |
|---|---|---|---|---|---|
| 1 | Approved company signing certificate (A + B) | Company Signing Key Owner + IT Admin | 4 secret names present; variable set; fingerprint confirmed from two trusted records | NOT READY — 0 secrets, 0 variables, no trusted fingerprint (checked 2026-11-01) | |
| 2 | Signed APK from latest code synced to the existing GitHub repository (C + D) | Lovable Project Owner + IT Admin | GitHub `main` = latest Lovable commit; run link; signer/package/version lines; APK SHA-256; `sha256sum -c` OK | NOT READY — repository stale; no official build | |
| 3 | Real-device end-to-end acceptance test (E) | Agent Tester + IT Admin | completed `docs/ANDROID_DEVICE_ACCEPTANCE.md` with screenshots/recordings | NOT DONE | |

Internal approval to install on agent phones: ________ (IT Admin)  ________ (Executive HQ)  Date: ________
