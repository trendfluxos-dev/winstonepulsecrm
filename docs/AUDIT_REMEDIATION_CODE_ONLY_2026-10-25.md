# Winstone Pulse — code-only audit remediation

## Production boundary

This pass is **not deployed**. No migration, schema/data change, live business-data query, user creation, payment action, assignment, AI call, or publication was executed. Lovable Cloud readiness only was checked: auth and database responding normally. Preview and production share a database; therefore authenticated browser flows and database integration tests are deliberately not run.

## Field dictionary and reporting contract

All calendar-day reporting uses **Asia/Dhaka**, inclusive `00:00:00.000` through `23:59:59.999` (+06:00), represented as UTC instants. For 2026-10-25 this is `2026-10-24T18:00:00.000Z` through `2026-10-25T17:59:59.999Z`. Rolling pipeline days are elapsed 24-hour intervals, **not** calendar-day totals. Dates remain as captured; late uploads do not move the call date.

| Term | Canonical fields | Meaning / limitation |
|---|---|---|
| Physical call | Android `call_uid` → `call_recordings.external_call_id` | One observed carrier lifecycle; not one uploaded file. No guessed call from audio length. |
| Call observation | `call_status`, `started_at`, `answered_at`, `finished_at`, `duration_seconds`, `device_id` | Phone evidence; terminal state cannot regress when offline events arrive out of order. |
| Call report | `call_reports.id`, `recording_id`, `status`, `submitted_at` | Agent-authored factual outcome. A report is not proof audio exists. The reporting window uses submission time where reporting submission activity. |
| Audio upload | `client_upload_id`, `checksum`, `storage_path`, `audio_url`, `upload_status` | Stable upload identity and SHA-256; storage reference plus uploaded state is stored-audio evidence, not independent file verification. |
| Recording availability | `recording_status` | Writers use `available`; legacy `stored` maps to available only with storage/upload evidence. Unknown/pending/unavailable never means verified. |
| Phone report sync | server report response / Android `lastReportSyncedAtMillis` | Separate from audio upload acknowledgement. |
| Phone audio acknowledgement | recording ID + `upload_status=uploaded` + server checksum matching local bytes | Only then may queued audio be deleted. Not a `verified` file/Drive/analysis claim. |
| Transcription / AI | `stt_status`, `transcription_text`, `analysis_status`, `analysis_error` | Independent durable processing stages; uploaded audio does not imply transcript or summary. |
| Sync failure | WorkManager retry and surfaced error; `sync_events` / job error fields | A failed stage or offline item, not a missing or fabricated call. Counts across stages must not be added as unique-call counts. |
| Follow-up | `follow_up_events.id`, `agent_id`, `lead_id`, `scheduled_at`, `completed_at`, `status` | Reminder/work item. Active feeds use the existing current-work view; original history remains immutable. |
| Ownership | canonical lead owner plus `lead_assignments.created_at/to_agent_id` | Current owner alone cannot prove historical responsibility; missing transfer evidence is ownership uncertain. |
| HQ feed freshness | `freshness.generatedAt`, timezone, fully paged flags | Time the reports/follow-ups were read, not an atomic cross-table snapshot or assurance that phone offline work arrived. |
| Pipeline coverage | selected rolling period, latest ≤200 recordings | Sample counts, not whole-system audio coverage or a measured improvement percentage. |
| Accountability | stored review metrics + `evidence.measured_at/window` | Historical review snapshot, not a live employee-fault verdict. New evidence classification does not rewrite old reviews. |

## Implemented safeguards

- Android lifecycle, audio queue and report-open now carry the same physical call UID. Real queued audio is copied into durable app files rather than eviction-prone cache. Upload identity no longer depends on a repeatedly reused filename.
- Server fills the existing owned lifecycle row, checks checksum and owner/lead identity before reuse, and rejects identical content already associated with a different call. Audio upload cannot increment dials or invent connected outcomes. Analysis is left to the existing durable sweep rather than upload-time AI work.
- Replayed lifecycle observations preserve terminal status, stored audio and terminal evidence fields. Reports reuse their stable recording link even after submission.
- Inactive, pending approval, rejected, and SIM conflict/invalid login causes are distinct. Recovery hints never grant access. IT retains account ownership; briefing and billing gates are not removed.
- LeadHub shows the unassigned queue and real eligible roster. Quantity assignment previews actual lead identities using oldest-first canonical phone dedupe and existing eligibility/quota checks. Confirmation recomputes and refuses a changed preview; no replacement leads are silently selected. Existing assignment history and audit metadata remain in use.
- Overdue classifier yields `validated_overdue`, `system_blocked`, `rescheduled`, `duplicate`, `ownership_uncertain`, or `needs_review`. Only validated overdue enters employee-fault follow-up counts. Invalid/late-created tasks or incomplete ownership history are excluded pending review. Missing measurement queries or capped evidence fail rather than becoming misleading zero totals.

## Blocked / limits requiring further action

1. **Actual audio recovery and device E2E:** real authorized Android/OEM handset, required phone/media permissions and genuine call recordings are needed. No code can manufacture the 558 previously missing files, and coverage has not been remeasured.
2. **Android compilation/tests:** sandbox has no Java/JAVA_HOME. Run `./gradlew :app:testDebugUnitTest --offline` with JDK and the existing Android SDK in a safe development environment; APK build/distribution is outside this pass.
3. **Existing legacy identifier mismatches:** new events reconcile one UID; old unrelated upload rows require human review of agent/lead/timestamps/checksum. No historical linking/backfill was executed. Missing legacy checksums are rejected for identity reuse rather than assumed equal.
4. **Concurrent content dedupe / fully atomic assignment+history:** existing unique call/upload keys and guarded updates remain. A new checksum uniqueness constraint or transactional assignment/audit operation would require a reviewed migration; not added here. If history save fails after assignment, IT review is required before retry. Repeated upload event audit entries are not claimed exactly-once.
5. **System-block responsibility windows:** existing data does not provide a complete per-task historical record for every inactive/briefing/device/network block. The pure classifier supports explicit bounded evidence; the production measurement does not invent block intervals. Human review must supply verifiable evidence or a separately approved append-only evidence design. Current assignment history is deliberately conservative; ambiguous reassignments remain uncertain.
6. **All employee-fault surfaces:** this pass integrates exclusions into new daily accountability measurements. Old cached reviews and every coach/HQ historical KPI are not rewritten or certified; raw operational overdue counts remain operational workload, not blame.
7. **Service-bill deep scan finding:** authenticated staff bill notice remains unchanged because earlier conversation explicitly retained that behavior and this task forbids billing-enforcement changes. The report is still open; no fresh built-in deep scan was triggered. Owner must run **More → Security → Run deep scan**. Restricting the notice audience requires an explicit policy decision, not bypassing existing review/admin/PIN rules.
8. **Live DB/RLS/51st lead/payment/permission walkthrough:** intentionally not exercised. The isolated tests prove code behavior, not a live device, stored-data repair, or paid/locked state. Use isolated staging and real approved input for mutation E2E.
9. **Google Ads/Wiz/Drive and AI delivery:** not connected or exercised in this pass; Google Ads remains last by owner instruction. Real Drive verification requires authorized access and actual files; transcription/summary verification requires genuine audio and separately authorized credit usage.

## Verification record

Exact test commands, latest counts and automatic build diagnostics are recorded in `roadmap.md`. Builds/typechecks are executed by the project's automatic harness; they were not manually invoked. No deployment was requested or performed.