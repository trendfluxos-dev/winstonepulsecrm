# Android ↔ Web CRM consistency and call-time audit

Code-level audit, 2026-11-01 (Dhaka). Read from source only; live deployment, the live database state and
real handsets were **not** inspected. Scope: internal company APK `com.winstone.connect` 2.21 (32).
Paths: Android = `android/app/src/main/java/com/winstone/connect/…`; server = `src/…`.

## 1. Same backend — established by code

- The APK talks only to the web CRM's own HTTP API, never to the database directly:
  `data/remote/WinstoneApi.kt:26-27` `BASE_URL = "https://crm.winstonebd.com"`; no database client in the Android sources.
  (`build.gradle.kts:27-28` defines `CRM_BASE_URL`, but no client reads it — the host is effectively fixed.)
- Endpoints (all `/api/public/…`, device-token auth via `src/lib/device-auth.server.ts:117-145`; identity comes from the
  token's `agent_devices.profile_id`, never from the request body): `agent/login`, `agent/logout`, `agent/call-start`,
  `agent/call-state`, `agent/incoming-call`, `ingest/recording`, `ingest/outcome`, `ingest/lead`, `agent/report`,
  `agent/workspace`, `agent/presence`, `agent/device-capability`, `agent/recorder`, plus briefing/notices/reminders/version.
- These handlers write the same tables the web CRM reads: `leads`, `call_recordings`, `call_reports`, `lead_events`,
  `sync_events`, `phone_outcome_receipts`, storage bucket `call-audio`. Web readers: Desk `src/lib/agent-desk.functions.ts:66-114`,
  calls `src/lib/crm.functions.ts:103-144`, reports `src/lib/call-reports.functions.ts:488-500`.
  Report submission from phone and web share one service ending in `finalize_call_report_v2` (`src/lib/call-reports.server.ts:603-619`).
- Not verified: that the published site runs this exact code (GitHub/publish state is separate).

## 2. Call lifecycle evidence

| Case | Source on the phone | What the CRM stores |
|---|---|---|
| Call start | PHONE_STATE OFFHOOK epoch ms (`telephony/CallStateReceiver.kt:41`) | `started_at` (`initiated`) |
| Answer (incoming) | OFFHOOK after RINGING — real | `answered_at` |
| Answer (outgoing) | **OFFHOOK = dialling started, not answer** (`telephony/CallLifecycle.kt:51-52`) | **sent as `answered` — gap G1** |
| End / duration (live) | IDLE − OFFHOOK, clamped 0–86 400 s (`CallStateReceiver.kt:134`) — includes ringing for outgoing | `finished_at`, `duration_seconds` |
| End / duration (call log) | Android `CallLog.DURATION` (real talk time), `log-<rowId>-<tail>` id (`telephony/CallLogSweeper.kt:93-105`) | phone-measured (`src/lib/call-duration.ts:97-107`) |
| Missed / rejected / blocked / voicemail | CallLog TYPE (`telephony/CallLogClassifier.kt:16-33`) → `no_answer`; fine-grained kind not uploaded | `no_answer` |
| Permission denied | sweep returns without moving its cursor; re-runs on grant (`CallLogSweeper.kt:42-46`, `MainActivity.kt:194-198`) | nothing invented |
| Recording unavailable | `recording_status = not_available` unless real audio stored (`src/routes/api/public/agent/call-state.ts:70-75`) | report continues |
| FAKE LEAD on unanswered | blocked (`src/lib/call-qualification.ts:21-24`) | — |

No production code fabricates calls; synthetic data exists only in the network-less sandbox build.

## 3. Time convention — consistent

Phone sends UTC ISO strings (`data/IsoTime.kt:13`, `CallLogSweeper.kt:120-122`, explicit `TimeZone "UTC"`); the server
accepts only ISO with offset (`z.string().datetime({ offset: true })`, e.g. `agent/call-state.ts:21`) and stores `timestamptz`.
Display uses Asia/Dhaka (`ui/DeskScreen.kt:1147,1323`; `src/lib/agent-briefing.server.ts:15-29`). No device-local strings sent.

## 4. Sync reliability

Good: WorkManager queue with network constraint and backoff (`data/sync/CallSyncQueue.kt:285-298`); stable call ids
(`and-…`, `log-…`) uniquely stored in `external_call_id`; outcome receipts unique per `(agent_id, call_uid)` (migration 0137);
report finalisation row-locked with `alreadySubmitted` on repeat; recording originals deleted only after the server returns
id + `uploaded` + matching checksum (`data/sync/QueuedAudioIdentity.kt:9-12`); per-employee stamping drops work after an
account switch; Pending/Syncing/Synced/Failed shown (`data/sync/RecordingSyncLabel.kt`). Server refuses unassigned/foreign
leads (`agent/call-state.ts:56-66`, `ingest/recording.ts:149-166`); unknown incoming numbers enter intake unassigned.

## 5. Recording

Upload only after per-employee, per-version consent (`telephony/RecordingConsent.kt:35-64`) and only real audio:
app capture must be two-sided (`CallLifecycle.uploadable`), else the phone's own recorder file is picked up
(`data/sync/PhoneRecordingPickupWorker.kt`); no file → nothing uploaded. Server checks size ≤ 24 MiB, extension and
container signature (`src/lib/call-intel.server.ts:224-246`). Android 10+ blocks app call-audio on most phones, so many
calls will have **no recording**; that is expected and is not a failure.

## 6. Gaps (severity, status)

| # | Gap | Impact | Status |
|---|---|---|---|
| G1 | **P1** Outgoing OFFHOOK reported as `answered`; IDLE as `completed` with ringing-inclusive time. `call-state` then opens the report as connected, and `isPhoneMeasuredCall` counts `android_sim` rows as phone-measured, so an unanswered app-dialled call can look connected/verified. | false "connected", inflated talk time / verified-call KPI | **Open — needs owner decision** (changes KPI counts) |
| G2 | **P1** The later call-log row (true `CallLog.DURATION`) for the same call is discarded as a duplicate (`agent/incoming-call.ts:76-100`) instead of correcting the live row. | real evidence thrown away | Open — fix needs a stored call-log-duration field (schema change) |
| G3 | P2 `call-state` acknowledged 200 even if the call-row update failed. | phone drops a state the CRM never saved | **Fixed** — now 500 so the phone retries; `tests/call-state-ack.test.ts` |
| G4 | P2 `ingest/outcome` sets `leads.is_verified` from a device `connected` flag (`ingest/outcome.ts:107`, migration 0137). | verification without recording/call-log proof | Open |
| G5 | P2 Phone-recorder pickup job not stamped with the original employee; upload worker does not recheck consent. | delayed file could be queued after account switch / consent withdrawal | Open (Android, needs CI compile) |
| G6 | P2 Pickup matching: number match optional, time window start−15 s…end+3 min. | wrong nearby recording possible | Open |
| G7 | P3 Retry worker does not distinguish 401/403/409/429/5xx; some job types retry without a ceiling. | battery/noise, stuck jobs | Open |
| G8 | P3 Replays append duplicate `call_started` / `recording_saved` timeline events; upload response always says `duplicate:false`. | cosmetic history duplicates | Open |

Recommended fix for G1+G2 (not applied): phone sends outgoing OFFHOOK as `initiated` and no `answered`; final
`completed`/`no_answer` and duration come from the matched CallLog row; server stores that call-log duration on the
same call row and only then treats it as phone-measured. Needs owner approval because verified-call KPI totals change.

## 7. Device evidence

Real-phone checks: `docs/ANDROID_DEVICE_ACCEPTANCE.md` — **NOT DONE**.
