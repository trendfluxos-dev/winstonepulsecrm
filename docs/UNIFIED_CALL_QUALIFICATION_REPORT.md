# Unified call qualification — implementation evidence

Date: 2026-10-31. **Release recommendation: NOT READY TO PUBLISH.**

## Implemented
- Both Web `submitMyReport` and Android `/api/public/agent/report` use `submitCallReport` → `qualifyCallReport`. Connected sales reports require six explicit booleans plus manual A/B/C/D; server calculates score/temperature with unchanged 15/15/10/20/20/10 points and 20/50 cutoffs.
- Manual grade is independent of temperature and does not require recording analysis. Android now serializes its selected grade; score/temperature remain preview-only and are not sent by Android.
- Final not_interested/wrong_number/fake disposition takes the short rejection path regardless of connection. Answers, score, model, temperature and grade are null; requirements/follow-up are cleared. Fake retains `interest=fake` and its reason while using the existing wrong_number storage category.
- Web exposes required manual grade and Fast Disqualification/reason; Android shows the same gate and grade definitions. Offline replay reaches the same backend validation.
- Existing no-answer cadence, callbacks, ownership, briefing call-start gates and report completion exemption remain. Atomic finalization and existing report/receipt idempotency are reused. Lead classifications are not fabricated for rejected calls; original classification history remains unchanged. Report corrections cannot switch sales↔rejection without full qualification validation.

## Actual verification
| Evidence | Result |
|---|---|
| Focused Vitest (9 report/qualification/Android-contract files) | 119 passed before the additional connected-form test; that updated UI file separately passed 8/8 |
| `bunx vitest run` final complete suite | 225 files passed / 1 skipped; 1,565 tests passed / 9 skipped |
| Actual React report form, mocked writes | 8 tests passed: rejection submissions and connected six-answer/manual-grade submission; no live rows written |
| `PGBIN=… scripts/run-sql-tests.sh` as local unprivileged user | 96 SQL assertions passed in throwaway PostgreSQL: atomic rollback/retry, duplicates, authorization, qualification and rejection audit |
| `bunx eslint src/lib/call-qualification.ts` | Passed; repository-wide lint not run/claimed |
| Automatic preview TypeScript/build check | Latest observed build OK at 05:39:24 UTC; no manual web build/typecheck run (managed checks) |
| `JAVA_HOME=… bash android/gradlew -p android :app:testDebugUnitTest` | BLOCKED before tasks: Gradle 8.9 download SSLHandshakeException/handshake_failure. No usable Android SDK verified |
| Android compile/emulator/handset | NOT TESTED for this change; added Kotlin regression tests have not executed |
| Live schema (read-only `pg_get_functiondef`) | Existing validate_call_report requires temperature/grade on every connected report; enforce_lead_completion requires classification |
| Publishing / production customer writes | None |

## Important release blocker
Live triggers conflict with null rejection classification. `docs/proposals/unified-call-qualification.UNAPPLIED.sql` contains function-only changes and was tested locally, **not applied**. No migration was added/applied and no customer data was changed. New rejection submits against the current shared live database can be refused; do not publish until this proposal is separately reviewed/applied through the managed migration path. It makes no data backfill, retains existing trigger bindings/access rules, and allows historical note corrections without retroactive scoring. Recovery restores prior function definitions, never deletes/restores business rows.

Existing Android APKs that omit grade will receive the actionable grade error on connected sales submission. Rollout needs compatible rebuilt APK plus web/backend deployment together. Physical two-agent tests must verify offline retry, manual grade retention, rejection with connected conversation, pre-briefing historical report completion and delayed recording upload. No real-agent save/read-back or audio-upload evidence obtained here.

## Files changed
- `src/lib/call-qualification.ts` (new authoritative validator/grade options)
- `src/lib/fast-disqualification.ts`, `src/lib/call-reports.server.ts`
- `src/components/crm/PostCallReportGate.tsx`
- `android/app/src/main/java/com/winstone/connect/data/remote/WinstoneApi.kt`
- `android/app/src/main/java/com/winstone/connect/ui/LiveCallScreen.kt`
- `android/app/src/test/java/com/winstone/connect/ReportQualificationTest.kt` (new)
- `tests/call-qualification.test.ts`, `tests/sql/qualification.test.sql` (new)
- `tests/fast-disqualification.test.ts`, `tests/targeted-security-boundaries.test.ts`, `tests/android-sync-audit-fixes.test.ts`, `tests/lead-grade-permissions.test.ts`, `tests/mobile-rejection-ui.test.ts`
- `scripts/run-sql-tests.sh`, `src/lib/AGENTS.md`, `roadmap.md`, this report and unapplied proposal

Code checkpoint before this documentation: `fd0510577dd250fd7e2566f9a4fd52c14680aae8`; managed saving may create a later documentation commit. Preview: https://id-preview--990267f3-4198-4d83-ae21-7d9c802617f4.lovable.app

## Fresh workspace connections
GitHub API linked fresh, `/user` HTTP 200 → trendfluxos-dev. Google Search Console linked fresh, `/webmasters/v3/sites` HTTP 200 → https://crm.winstonebd.com/ siteOwner. These verify API access, not repository Git sync or deployment. No sitemap submission/provider writes performed.