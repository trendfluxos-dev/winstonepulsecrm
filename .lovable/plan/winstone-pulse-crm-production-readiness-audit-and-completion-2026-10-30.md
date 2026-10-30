# Winstone Pulse CRM — Production-Readiness Audit and Completion Plan

Read-only audit, 2026-10-30. No code, data, settings or deployments were changed.

## Verdict

**Not safe to call "complete" or to deploy new work right now.** The live app keeps running as it is. Before the next publish, the P0 items need fixing. I did not observe 100% readiness.

## What was inspected (evidence)

- Repo: 69 route files, 15 migration files, 212 test files, 4 automatic-check workflows (`ci.yml`, `android-apk.yml`, `android-ui-tests.yml`, `build-tool-pin.yml`). Rules are in `AGENTS.md`, `src/lib/AGENTS.md` and `android/AGENTS.md`.
- Last recorded test run (2026-10-29): 1,440 passed, 13 skipped. Automatic preview build: OK.
- Deep security scan (latest stored results): **1 error and 7 warnings**, some dated as early as Oct 7 and Oct 14.
- `roadmap.md`: 5 items still open (listed under P1/P2).
- Placeholder/TODO markers are concentrated in `SalesIntelPanels.tsx` (15), `unit-board.tsx` (9) and `ProjectCatalog.tsx` (7). Some are probably form placeholder text and need to be sorted from real gaps.

## P0 — must fix before the next publish

1. **Public write into customer conversations** (scan level: error, `receiveMessage`)
   - Files: the support/Messenger inbound handler named by the finding, under `src/lib/support*` / `src/routes/api/public/*`.
   - Acceptance: an unsigned or unauthenticated request is refused (401/403) and adds no row; a valid signed request is accepted once and its replay is ignored; a test covers both cases; the rescan clears the finding.
2. **Android signing key and local config are tracked in the repository** (`android/winstone-release.jks`, `android/local.properties`)
   - Risk: anyone who can read the repo could sign fake app updates.
   - Acceptance: both files are removed from tracking and added to `.gitignore`; CI signs from secrets only. The owner decides whether to rotate the key. Rotating forces a reinstall, so it is an owner/provider decision. Git history cleanup is an owner action outside the app.
3. **Caller-chosen dates and amounts in WhatsApp templates** (`src/lib/whatsapp.functions.ts:58-132`, `src/lib/whatsapp-templates.ts:51`)
   - Acceptance: visit-date and payment-amount values come from the saved site_visit, booking or payment-schedule records and not from the request; mismatches are rejected; tests prove the forged-value case fails. Closes both WhatsApp findings.
4. **Leads can still reach an account after its approval is revoked** (`releaseDueGrants`)
   - Acceptance: release and allocation re-check `is_active_staff` and approval at execution time; a revoked agent gets 0 leads; there is a test. LeadHub stays the only assignment path.

## P1 — complete within the next release cycle

5. Voice-note uploads accept files that are not audio (`storeVoiceNote`, Recorder). Acceptance: check MIME type, file signature and size limit on the server; a test rejects a disguised file.
6. Messenger sync decisions writable by any signed-in user. Acceptance: full IT PIN required on the server, with a test. This was reportedly fixed before, so confirm it and rescan.
7. Staff photos readable by any signed-in user. Acceptance: storage policy limited to active staff, or the risk is accepted in writing by the owner.
8. Internal release details are public (`GET` app releases). Acceptance: only the version and download data the APK updater needs are exposed; notes and internal fields are removed.
9. Guest support AI limits (5 per conversation, 200 per 24h) are built but **not published**. Acceptance: published, then verified live.
10. Fresh full security scan plus database linter after P0/P1. Acceptance: no error-level findings; every remaining warning is fixed or accepted by the owner in writing.
11. Placeholder triage in `SalesIntelPanels.tsx`, `unit-board.tsx`, `ProjectCatalog.tsx`, `customers.tsx` and `NewLeadDialog.tsx`. Acceptance: each marker is either real input placeholder text or is listed as an implemented or planned gap. No fake data appears in the UI.

## P2 — evidence gaps and owner/provider actions

12. Android: native UI tests (8 scenarios) and unit tests (4) **NOT VERIFIED**, because JDK 17, SDK 35 and a device are not available here. Acceptance: the `android-ui-tests.yml` run passes, a signed APK is built and installed on one staff handset, and a real call plus report save is read back in the CRM.
13. Real authorized call end to end (rejection report save and read-back): **NOT VERIFIED**.
14. WhatsApp provider send, Messenger (stays off) and Windsor: **NOT VERIFIED**. They need Meta approvals from the owner or provider.
15. The GitHub CI workflow has never been observed running on a real pull request: **NOT VERIFIED**.
16. Backups: no restore drill confirmed. Acceptance: the owner checks the newest daily backup timestamp and an export is taken before any risky migration. Storage files are not included in backups.
17. Reading RLS policies table by table, checking Dhaka-timezone edge cases at the 00:00 and 15th lock, CSV export neutralisation, and phone-size and accessibility checks on every staff page: partially covered by existing tests. A full sweep is **NOT VERIFIED** in this audit.
18. Owner decisions still open: switching call summaries to Gemini, the ad campaign (paused because the offer isn't suitable for the public), and pricing for the phone-upgrade bill.

## How each step is verified

Focused tests for each fix, then the full suite (baseline 1,440 passing). A clean automatic build. A rescan for every security item. Live markers (`/manual` version, $35.29, 50-lead) are checked only after the owner explicitly approves publishing. No production data writes and no customer messages at any point.

## Technical notes

- Order of work: P0-1 → P0-3 → P0-4 → P0-2 (repo hygiene; it can't break the app) → P1 → rescan.
- All fixes follow the existing server-only and append-only rules in `src/lib/AGENTS.md`. No new assignment path and no deletes.
