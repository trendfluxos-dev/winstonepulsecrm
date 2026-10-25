# Roadmap

## Daily Lead Report — publish and activate at 17:35 Dhaka
- [x] Publish the existing callback; live POST now returns 401 without managed authentication (not 404). Active managed 11:35 UTC / 17:35 Dhaka schedule preserved without duplication.
- [x] 12 targeted schedule/sheet tests pass; live release checker confirms v1.6.0, $35.29 and 50-lead markers deployed.
- [ ] First scheduled export remains unverified until today's 17:35 Dhaka run reports success; managed delivery may spread by about 30 seconds. No immediate export or extra job created.

## Current checks — report schedule, Messenger samples, Meta and today's allocation
- [x] Daily report schedule read back active at 17:35 Dhaka after the 17:30 summary; do not duplicate/change it. Callback published and live unauthenticated POST now returns 401, superseding the previous 404.
- [x] Add off-by-default local-only sample details: complete demo-1, optional-field gaps demo-2 and unlinked empty demo-3/4. 31 tests pass, colors pass, browser verified complete/missing/empty with zero page errors; harness build OK. No CRM records or demo-to-live lookup.
- [x] Read-only today check (2026-10-25 Dhaka): all 8 active approved agents have 0 ledger assignments today and no matching assignment audit rows; all have older currently assigned leads (50–505 each). No assignment performed.
- [ ] Callback publication completed by explicit owner request; first scheduled report execution awaits the 17:35 Dhaka run. Nothing will execute after this turn except the existing configured jobs.
- [ ] Inventory activation blocked by owner-provided sheet URL/tab (still absent); no Daily Lead Report substitution.
- [ ] Meta messages subscription cannot be verified without provider authorization; stored App Review/Live mode/Page consent/messages subscription evidence and sync-enable decision are empty. Keep sync off; no invented evidence or Meta activation.

## Messenger — lead details beside messages
- [x] Add read-only linked-lead sidebar beside the selected conversation (stacked below on smaller screens); saved inbound message IDs only, independent thread and current lead ownership checks. Demo/disconnected data never reads real leads; Meta activation unchanged.
- [x] 42 targeted Messenger/inventory tests pass, semantic colors pass, harness build OK. Signed-in browser shows inactive sidebar with no runtime errors; job remains 401 without managed auth. Tests now isolate environment flags rather than depend on real Meta settings.
- [ ] Live lead-detail proof awaits approved Meta activation and future stored-message inbox wiring; existing inbox still supplies demos and the service remains fail-closed. No real messages, leads, settings, secrets or deployment changed.


## Inventory & pricing sheet — listings and integrations roadmap
- [ ] Owner chose to provide the existing inventory/pricing sheet link; link and tab name still pending. Accessible Zahid's Drive (2) lists only Daily Lead Report; no inventory sheet found.
- [x] Add authenticated, read-only cached sheet sync beside /projects and /unit-board listings; preserve canonical CRM inventory/bookings, verified snapshot backups and safe failure state.
- [x] Add source/status/next steps and IT-only linking/refresh to /integrations without exposing inventory publicly. 21 targeted tests pass; global colors pass; harness build OK; public/private UI inspected, signed-in pending-source state verified, unauthenticated job POST 401.
- [ ] First real-source sync and automatic hourly activation await the owner's sheet link/tab, real read-back through staff UI, publication and managed schedule registration; no schedule or production inventory changes made.

## Daily Lead Report — automatic post-shift sync
- [x] Add a managed authenticated daily callback after the evening shift summary (17:35 Asia/Dhaka).
- [x] Verify synthetic authentication, payload validation and sync results: 12 tests pass; preview unauthenticated POST returns 401; harness build OK. Automatic updates verify a retained backup, match lead IDs, preserve HQ notes/payments and never clear older rows; manual sync remains unchanged.
- [x] Register and read back managed schedule `winstone-lead-report-after-shift`, daily 11:35 UTC, active; do not modify the existing unmanaged `winstone-daily-sheet-sync` job.
- [ ] Callback publication completed and live authentication refusal verified on 2026-10-25; first scheduled run remains unverified. No immediate real lead export performed during verification. Schedule timing may spread up to about 30 seconds.

## 2026-10-25 — Google Calendar linked; site-visit calendar sync live-capable (03:15 UTC)
- [x] Google Calendar connection (Zahid's Google Calendar 2) linked to the project; gateway read verified (calendar list OK, primary calendar Asia/Dhaka, events write scope configured).
- [x] Site visit → team Calendar sync already existed (`addSiteVisitToTeamCalendar` in site-visits.functions.ts + button in SiteVisitsPanel): confirmed visits only, one event per visit, no customer phone sent, event id stored on the row. It was blocked only by the missing connection — now unblocked. Supersedes the older blocked Calendar entries below (shared team calendar path; per-agent own calendars still need a workspace Google OAuth client).
- [ ] First real proof: add one confirmed site visit to the calendar from the CRM and confirm the event appears (user action, creates a real event).

## 2026-10-25 — HQ panel shows the latest AI failure alongside the last success (01:33 UTC)
- [x] HQ status row now carries the last failed call too: Dhaka timestamp + HTTP status + short safe reason (`402 · billing/credits`, `429 · AI busy`, `500 · service unavailable`, `no usable answer`), or "No failed AI call yet" while nothing has failed. Active model and last success stay as before.
- [x] Failures that never produced an HTTP status (network error, unreadable/missing answer) are now recorded as `AI_NO_RESPONSE_STATUS` (0) instead of being invisible, and non-finite statuses are normalised — the recorded failure time is always the latest attempt. Stored fields remain model name, ISO time and status number only.
- [x] Fixed the typecheck error the build reported in `recordAiStatus` (`Record<string, unknown>` → Supabase `Json`): the merge callback is typed as `AiStatusRecord`. 5 new tests (23 total, all passing). Docs: `docs/AI_PROVIDERS.md` status-indicator section. No secrets, live calls, migrations, data changes or deployment.
- [x] Two stale tests the full run exposed were repaired (both pre-existing, unrelated to this feature): the `targeted-security-boundaries` mock of `@/lib/ai-model.server` now defines `getAiModelStatus` (the HQ indicator export), and the desk tab-bar count matches the 14 current sections. Full isolated run: 137 files / 978 tests passing.



## 2026-10-25 — Meta billing hint + live smoke test (01:29 UTC)
- [x] Authorized live smoke test of Muse Spark: endpoint reachable, key accepted far enough for a structured response, but Meta returned HTTP 402 (billing/credits inactive). No key/headers/body logged; no settings changed.
- [x] HQ billing hint: `withLastFailure` records last failed call's HTTP status only (never bodies); `aiChatJson` records failures via shared `recordAiStatus` helper; HQ panel shows a bilingual Meta billing notice when the last call was 402/403 or no success yet. 2 new tests (18 total, all passing).

## 2026-10-25 — HQ AI status indicator + Meta activated (01:22 UTC)
- [x] Owner added `MODEL_API_KEY` via secure form; presence verified (never displayed). Active model set to `meta` in app_config (owner request, 01:19 UTC).
- [x] HQ panel status indicator: active model + last successful AI call time (Dhaka), secret-free. `withLastSuccess` merges timestamp into app_config without dropping the model choice; recording is best-effort and never breaks AI calls. 3 new tests (16 total, all passing).

## 2026-10-25 — Zero-setup AI default; Meta picker gated on configuration (01:13 UTC)
- [x] OpenAI/Gemini via the already-provisioned Lovable AI Gateway remain the zero-setup default (`openai`); no account/key/action needed from the user.
- [x] `isProviderConfigured` (presence-only, secret-safe) added to `ai-providers.ts`; `getAiModelStatus` exposes `metaConfigured` to staff UI; `setAiModelChoice` now refuses to store an unconfigured provider (fail-closed at the write path, not just at call time).
- [x] HQ picker (`AiTeamSummary.tsx`): Meta option disabled and labelled "setup required" until `MODEL_API_KEY` exists; warning banner if a stored `meta` choice is unconfigured. 3 new tests (13 total in `tests/ai-providers.test.ts`, all passing). Docs updated. No secrets requested/created, no live calls, no deploy.

## 2026-10-25 — Meta Model API (Muse Spark) as optional AI provider (01:06 UTC, preparation only)
- [x] Extended the existing shared AI helper (no parallel path): new pure module `src/lib/ai-providers.ts` (choice parsing, provider resolution, fail-closed secret-safe key check); `ai-model.server.ts` routes `meta` → `https://api.meta.ai/v1/chat/completions`, model `muse-spark-1.3`, key `MODEL_API_KEY` read only inside the handler. OpenAI/Gemini behavior unchanged; provider error bodies no longer logged (status only).
- [x] HQ model picker (`AiTeamSummary.tsx`) + `setAiModel` zod enum now accept `meta`. New `tests/ai-providers.test.ts` (12 tests: selection, resolution, missing-key fail-closed, no cross-provider key fallback, secret-safe errors). 2 files / 37 tests passed 01:09 UTC. Docs: `docs/AI_PROVIDERS.md` with exact secret setup + never-commit warning.
- [ ] Compatibility blocker documented: current adapter is chat-completions HTTP, not the Responses API — `reasoning.encrypted_content`/high reasoning unsupported until a reviewed adapter change. No live Meta API request sent; no key requested/stored; no deploy.

## 2026-10-25 — Messenger review pass + store defect fix (01:04 UTC)
- [x] Full review of the Meta/Messenger pipeline: 16 files / 116 tests passed; live preview probes confirmed fail-closed — unsigned POST 503, fake-signed POST 503, wrong-verify-token handshake 503, human GET 303 → /messenger. No secrets, no Meta calls, no migrations, no gate changes.
- [x] Fixed one real defect: `recordStatus` in `messenger-store.server.ts` crashed (23502 on NOT NULL thread_id) when a delivery/read/echo event arrived for a never-seen thread; it now skips gracefully (receipt still records the event). New `tests/messenger-store.test.ts` (3 tests: missing thread, existing thread, missing table). 4 files / 29 tests passed 01:05 UTC.

## 2026-10-25 — Sync enable/disable audit log (owner request 00:54 UTC)
- [x] `messenger_sync_decisions` (0127, append-only, service_role-only, RLS on): every sync enable/disable decision records staff, Dhaka time, verification snapshot (verified/missing tracks) and reason.
- [x] `src/lib/messenger-sync-decisions.ts` + `.functions.ts`: IT-only recording; an enable decision is refused server-side unless all four verification tracks' latest outcome is "verified" (VERIFICATION_INCOMPLETE with the missing tracks); disable always allowed; reasons validated so no token-like text is stored.
- [x] Webhook POST gate now needs BOTH the env switch AND a latest audit "enable" decision — fail-closed on any lookup error. UI: `MessengerSyncAudit.tsx` on /inbox shows current decision, history and the IT form.
- [x] 6 files / 65 tests passed 00:57 UTC (new: 10 sync-decision tests).
- [ ] Still blocking real sync: `META_APP_SECRET` + `META_WEBHOOK_VERIFY_TOKEN` unsaved (secure form cancelled by owner), Meta-side webhook registration, and the four verification tracks themselves.

## 2026-10-25 — Safe Meta verification checklist on /inbox
- [x] Owner request 00:49 UTC done: `meta_verification_records` (0126, append-only, service_role-only) + `src/lib/meta-verification.ts` (4 fixed tracks: app_review, live_mode, page_consent, messages_subscription) + `meta-verification.functions.ts` (IT-only record, staff read) + checklist UI in `MetaVerificationReport.tsx` with real Dhaka timestamps. `validateEvidenceNote` rejects any note that changes under credential redaction — no access token can be stored as evidence.

## 2026-10-25 — Messenger retention + webhook handshake activation
- [x] Retention (owner request 00:46 UTC): `MESSENGER_RETENTION_DAYS` bodies 90d, thread events/receipts 180d, sent outbox 90d; `0125_messenger_retention_policy.sql` lets the trigger allow deletes only past the window (updates still blocked); cron route `/api/public/jobs/messenger-retention` (authenticateCronRequest, counts only, never pending retries) + managed schedule `messenger-retention-cleanup` daily 21:30 UTC (03:30 Dhaka). UI note on /inbox.
- [x] Webhook GET subscription handshake wired (exact verify-token match → 200 challenge; mismatch → 403; unconfigured → 503); human navigation still 303s to /messenger.
- [x] Ingestion switch `MESSENGER_INGESTION_ENABLED=true` set by owner order; POST still refuses without `META_APP_SECRET`, and Meta-side registration still needs the verify token + App/Page approvals.
- [ ] `META_APP_SECRET` + `META_WEBHOOK_VERIFY_TOKEN` secure form rejected by owner 00:51 UTC — not configured; owner can save them later via Project Settings → Secrets. Until then POST refuses 503 and the handshake answers 503.
- [x] 11 files / 89 tests passed 00:51:15 UTC (retention, verification checklist, crypto, delivery, inbox, webhook, ingest, review, routes, boundaries).

## 2026-10-25 — Verification report, delivery diagnostics, message encryption
- [x] Read-only verification report on `/inbox` (`src/lib/meta-verification-report.ts` + `MetaVerificationReport.tsx`): three separate evidence tracks — Messenger App Review approval, Page subscription, old-token revocation — each unverified with null checkedAt and its own blocker; no track borrows another's proof.
- [x] Webhook delivery diagnostics on `/inbox` (`src/lib/messenger-delivery.ts` pure summarizer, `messenger-delivery.functions.ts` staff-only server fn, `MessengerDeliveryStatus.tsx`): receipt totals/pending, delivery/read/postback/echo counts, outbox pending retries and latest failure code. Counts and codes only, never message content; storage errors report not-ready, never empty.
- [x] Server-side encryption at rest for message bodies: `drizzle/migrations/0124_messenger_message_encryption.sql` added nullable `body_ciphertext` (plaintext `body` deprecated as legacy fallback); `src/lib/messenger-crypto.server.ts` AES-256-GCM via Web Crypto, `v1.<iv>.<ct>` base64url, key from server-only `MESSENGER_MESSAGE_KEY` (generated 64-char, value never shown). Store encrypts on write and refuses to save without the key; review reads decrypt server-side with legacy plaintext fallback; undecryptable ciphertext is never shown raw.
- [x] `bunx vitest run` on 9 Messenger/route/boundary files — 77 tests passed, 00:17:09 UTC; harness build OK 00:17:17 UTC after fixing a noUncheckedIndexedAccess split-index type error. Updated the stale "migration not applied" test to assert the applied migrations plus the still-off ingestion flag.
- [ ] Unchanged boundary: ingestion switch OFF and webhook still refuses real events until authoritative Meta App/Page approval evidence; live publish authorized but not executed — publish only after that verification, with a signed durable read-back check after deploy.

## 2026-10-25 — Messenger durable storage migration applied (owner-authorized)
- [x] Owner authorized secure storage + live publish permission; applied the reviewed proposal byte-for-byte as `drizzle/migrations/0123_messenger_durable_storage.sql`: `meta_page_connections`, `messenger_threads`, `messenger_messages`, `messenger_webhook_receipts`, `messenger_thread_events`, `messenger_outbox` — all service_role-only grants, RLS enabled (verified via pg_tables: 6/6 rowsecurity=true), append-only triggers blocking update/delete of message/event/receipt history (single exception: one-time lead link on a reviewed message).
- [x] `docs/proposals/messenger-inbox-migration.UNAPPLIED.sql` renamed to `.APPLIED.sql` with applied-note header; types regenerated automatically. Harness build OK 00:11:41 UTC.
- [ ] Ingestion switch (`MESSENGER_INGESTION_ENABLED`) stays OFF and webhook keeps refusing with 503 until authoritative Meta evidence: App Review + pages_messaging tier, Live mode, Page consent, and messages subscriptions at App and Page level. Owner's "verify then activate" order preserved — verification first, sync second.
- [ ] Live publish is authorized but not executed this turn; publish only after the verification above, with a signed durable read-back check after deploy.

## 2026-10-25 — Durable Messenger receipt and reviewed lead intake (code only)
- [x] Wrote the durable pipeline the webhook was missing: exact raw-byte signature, strict payload parse, per-event atomic receipt with content hash, thread/message storage, and a staff-confirmed conversion that enters through the canonical intake path as an unassigned lead. Demo rows still cannot become CRM records; the reviewed storage migration stays unapplied and the ingestion switch stays off, so the live webhook keeps refusing with 503.
- [x] `bunx vitest run tests/messenger-ingest.test.ts tests/messenger-review.test.ts tests/messenger-webhook.test.ts tests/messenger-inbox.test.ts tests/messenger-readiness.test.ts` — 5 files / 41 tests passed; wider run with `tests/integration-boundaries.test.ts` and `tests/route-role-access.test.ts` — 7 files / 63 tests passed, 00:09 UTC. `bun run typecheck` clean; harness build OK 00:09:21 UTC. Live preview check: human GET still redirects 303 to `/messenger`; signed-looking and unsigned POSTs both return 503 `FACEBOOK_NOT_CONNECTED` because the preview environment has no App Secret configured — the 401/400/413 signature-path refusals are covered by unit tests, not by this preview run. Nothing was accepted or stored.
- Changed: `src/lib/meta-webhook-payload.ts`, `src/lib/messenger-ingest.server.ts`, `src/lib/messenger-store.server.ts`, `src/lib/messenger-review.server.ts`, `src/lib/messenger-webhook.server.ts`, `src/lib/messenger.functions.ts`, `tests/messenger-ingest.test.ts`, `tests/messenger-review.test.ts`, `docs/proposals/messenger-inbox-migration.UNAPPLIED.sql`, `docs/MESSENGER_SETUP.md`, `AGENTS.md`, `roadmap.md`.
- [x] Storage migration applied 2026-10-25 (owner-authorized, see section above). Still pending: verifying Meta App/Page approvals and setting the ingestion switch — each needs the owner's authoritative Meta evidence; neither is claimed here.
- [ ] Owner shared the Meta Graph API Explorer link: it can only be used from the owner's own browser session. Tokens must never be pasted into chat; the CRM's existing full-IT-PIN Meta test remains the in-app path, and App Review/Live mode/Advanced Access still need authoritative evidence the owner supplies.

## 2026-10-25 — Meta Integration & Webhook Control Center
- [x] Used uploaded HTML only as a privacy-safe reference; added authority-gated `/meta-control-center` with status/configuration/permission/diagnostic tabs and fixed synthetic simulator. No copied scripts, credentials or customer samples; no token inputs or real lead creation.
- [x] Added bounded UTF-8/Page event validation after exact raw-byte HMAC; disabled handshake/ingestion preserved. Valid signed events still 503, signed malformed payloads now 400. Durable atomic production idempotency remains blocked on separately approved storage/schema; local simulator never substitutes for it. No Meta calls, secret changes, SQL, production writes, auth/role changes or deployment.
- [x] 71 tests passed across seven relevant files; harness build OK. Signed-out authority gate verified. Isolated browser presentation harness verified all tabs, five presets, duplicate/conflict handling, reset, absent credential inputs and mobile no overflow; screenshots inspected. No provider traffic; authenticated CRM access and real receipt/delivery remain unverified under no-production-access constraint.
- Changed: `src/lib/meta-webhook-payload.ts`, `src/lib/meta-control-center.ts`, `src/lib/messenger-webhook.server.ts`, `src/components/crm/MetaControlCenter.tsx`, `src/routes/meta-control-center.tsx`, `src/components/crm/AppShell.tsx`, `src/components/crm/NavSidebar.tsx`, `src/lib/i18n.ts`, `tests/meta-control-center.test.ts`, `tests/messenger-webhook.test.ts`, `tests/route-role-access.test.ts`, `docs/META_CONTROL_CENTER.md`, `docs/MESSENGER_SETUP.md`, `AGENTS.md`, `roadmap.md`.
- Activation blockers: authoritative App/Page/permission/subscription evidence; reviewed durable receipt/message storage and atomic idempotency; genuine-message ownership/canonical intake; separately authorized deployment and signed durable read-back. HTML credential revocation must be completed by owner at Meta; no revocation claimed.

## 2026-10-25 — Interactive whole-CRM walkthrough
- [x] Added bilingual `/walkthrough`: 14 steps across Sales Agent, LeadHub Nexus, Executive HQ and IT Console; workspace/step switching, previous/next, local-only resume/reset, completed reading and links to existing gated pages. Entry from home, help and shared navigation. No live data/provider calls, permission changes or automatic business actions.
- [x] 21 tests passed (`crm-walkthrough`, `route-role-access`); harness build OK. Public browser flow verified all 14 steps, completion, reload resume, reset, workspace tabs and language switch; 1280px/390px screenshots inspected, no overflow or page errors. API traffic intercepted; protected linked workspaces not exercised under the no-production-access boundary. No deploy, SQL, database, auth or secret changes.

## 2026-10-25 — Five-service integration status page
- [x] Added public read-only `/integrations` with Messenger, WhatsApp, Windsor.ai, Drive and Winstone OS evidence boundaries, absent verified timestamps, blockers and verification steps. Messenger/Windsor inactive; other three unverified, never assumed disconnected. Navigation and existing progress page linked; no live reads, configuration changes or activation.
- [x] `bunx vitest run tests/integration-status.test.ts tests/messenger-readiness.test.ts tests/windsor-reporting.test.ts tests/route-role-access.test.ts tests/integration-boundaries.test.ts` — 5 files / 39 tests passed. Harness build OK 23:53:03 UTC. All content routes contain head metadata.
- [x] Public page browser check passed: five services, Bengali language, OS anchor, 1280px/390px screenshots inspected, no horizontal overflow or page errors. Server/provider/API traffic intercepted; only public presentation verified, no live integration operation claimed. Existing protected diagnostics were not invoked. No deploy, SQL, database, role, auth or secret changes.
- Changed: `src/lib/integration-status.ts`, `src/components/crm/IntegrationStatusPage.tsx`, `src/routes/integrations.tsx`, `src/components/crm/AppShell.tsx`, `src/components/crm/NavSidebar.tsx`, `src/lib/i18n.ts`, `src/routes/messenger-setup.tsx`, `tests/integration-status.test.ts`, `tests/route-role-access.test.ts`, `AGENTS.md`, `roadmap.md`.
- Live provider verification remains outside this presentation task: Messenger approvals/storage, WhatsApp signed durable callbacks, Windsor contract/account, Drive owner/file access, OS signed round trip require authorized evidence and existing setup gates; this page does not perform them.

## 2026-10-24 — Exposed Meta credential replacement
- [x] Owner saved replacement Page access token in the existing encrypted secret through the secure update form; no values inspected. Added full-IT-PIN-only, no-network storage check on `/inbox`: presence only, actual check time, revocation and production replacement explicitly unverified. Runtime diagnostics use one handler-only secret source, no cached/legacy token fallback. Page ID unchanged; no other configured Meta token was listed.
- [ ] Old token revocation/non-use requires owner Meta-side revocation evidence and separately authorized production release/live verification; no deploy, live provider request, old-token comparison, DB/schema/auth changes or activation. Other exposed external tokens must be revoked by their issuing Meta owner.
- [x] Verification: `bunx vitest run tests/meta-credential-safety.test.ts tests/meta-connection-boundary.test.ts tests/meta-connection-test.test.ts tests/messenger-webhook.test.ts tests/messenger-inbox.test.ts tests/integration-boundaries.test.ts` — 6 files / 33 tests passed, 23:22:23 UTC; harness build OK 23:22:19 UTC. Authenticated live check remains unverified under the current production boundary. Changed: `src/lib/meta-connection-test.functions.ts`, `src/components/crm/MetaConnectionTest.tsx`, `tests/meta-credential-safety.test.ts`, `docs/MESSENGER_SETUP.md`, `AGENTS.md`, `roadmap.md`.

## 2026-10-24 — Safe manual Meta connection test
- [x] Added `/inbox` manual full-IT-PIN-only test: configured Page identity, selected App/Page association and both messages subscription levels; GET-only server Authorization, 10s deadlines, 64KB responses, no redirects/raw error logs/token output. Missing configuration and access/subscription failures return safe codes and actual attempt time in Dhaka; no persisted history, customer reads or activation.
- [x] `bunx vitest run tests/meta-connection-test.test.ts tests/meta-connection-boundary.test.ts tests/messenger-webhook.test.ts tests/messenger-inbox.test.ts tests/messenger-readiness.test.ts tests/integration-boundaries.test.ts` — 6 files / 31 tests passed, exit 0, 23:18:08 UTC; harness build OK 23:18:01 UTC after correcting optional-property/fallback types. Synthetic transport tests only; no live Meta calls, secret changes, DB, migration or deployment.
- [ ] App Review, Live mode, Advanced Access and messaging grants remain unverified: identity/subscriptions alone do not establish them. Live authorized IT click and actual signed delivery remain untested; connection stays off. Changed: `src/lib/meta-connection-test.server.ts`, `src/lib/meta-connection-test.functions.ts`, `src/components/crm/MetaConnectionTest.tsx`, `src/components/crm/MessengerConnectionStatus.tsx`, `tests/meta-connection-test.test.ts`, `tests/meta-connection-boundary.test.ts`, `AGENTS.md`, `docs/MESSENGER_SETUP.md`, `roadmap.md`.

## 2026-10-24 — Signed webhook boundary / verification timestamps
- [x] POST signature validation implemented with handler-only `META_APP_SECRET`, exact raw bytes, 262144-byte streamed bound; malformed/mismatched signatures return 401, missing config 503, oversize 413, valid signature still 503 ingestion-not-ready (no data loss through false acknowledgement). GET handshake/adapter remain disabled.
- [x] `/inbox` shows signed-verification preparation and last-check absence; progress page shows both service blocker reasons and no invented timestamp/provider failure. Updated `docs/MESSENGER_SETUP.md` and `AGENTS.md` boundary.
- [x] `bunx vitest run tests/messenger-webhook.test.ts tests/messenger-protocol.test.ts tests/messenger-inbox.test.ts tests/messenger-readiness.test.ts tests/windsor-boundary.test.ts tests/integration-boundaries.test.ts` — 6 files / 48 tests passed, exit 0, 23:15:44 UTC. Harness build OK 23:15:39 UTC. Synthetic raw bytes tested; real Meta/credential/DB calls and signed-in UI not exercised.
- [ ] Durable verification time/failure history and live App/Page/subscription confirmation blocked by missing reviewed storage/authorized evidence. No schema, data, secret change or deployment. Changed: `src/lib/messenger-webhook.server.ts`, `src/lib/messenger-protocol.server.ts`, `src/routes/api/public/meta/messenger.ts`, `src/lib/integration-readiness.ts`, `src/routes/messenger-setup.tsx`, `src/components/crm/MessengerConnectionStatus.tsx`, `tests/messenger-webhook.test.ts`, `tests/messenger-inbox.test.ts`, `tests/messenger-readiness.test.ts`, `AGENTS.md`, `docs/MESSENGER_SETUP.md`, `roadmap.md`.

## 2026-10-24 — Inbox verification and Messenger lead provenance
- [x] Added public preparation summary to `/inbox`: Facebook disconnected, App/Page approvals and Messenger webhook subscription unverified, webhook disabled, progress link. No provider check claimed; Support Desk query/actions unchanged.
- [x] Lead dossier now displays saved source; exact Messenger sources show original arrival evidence unavailable and verification unverified. Existing schema has source/created_at/is_verified but no signed Messenger arrival/connection evidence; neither CRM creation time nor lead quality flag substitutes for it. Pure classifier excludes Facebook Ads sources.
- [x] `bunx vitest run tests/lead-provenance.test.ts tests/messenger-inbox.test.ts tests/messenger-readiness.test.ts tests/support-inbox-agent-scope.test.ts tests/route-role-access.test.ts tests/integration-boundaries.test.ts` — 6 files / 44 tests passed, exit 0, 23:13:25 UTC; harness build OK 23:13:20 UTC. Authenticated UI/real Messenger lead flow unverified under current production-read boundary. Changed: `src/lib/lead-provenance.ts`, `src/components/crm/LeadSourceDetails.tsx`, `src/components/crm/MessengerConnectionStatus.tsx`, `src/components/crm/LeadDossier.tsx`, `src/routes/inbox.tsx`, `tests/lead-provenance.test.ts`, `AGENTS.md`, `roadmap.md`.
- [ ] Original arrival/verified connection display from real receipts blocked by missing reviewed durable Messenger storage and authorized App/Page/subscription evidence. No database/secret/provider/deployment changes or invented lead/timestamp.
- [ ] Meta Ads secure connection card was cancelled before execution by a new message; connection not completed. Live verification still needs authorized Messenger-specific access/evidence, reviewed storage and separate activation safeguards.

## 2026-10-24 — Combined Messenger / Windsor progress
- [x] Restored `/messenger-setup` with Messenger and Windsor.ai disconnected statuses, explicit neither-connected notice, and Messenger navigation link; no provider activation, secrets or data changes. Shared browser-safe preparation helper reports Windsor configuration as not checked, never infers secrets absent.
- [x] `bunx vitest run tests/messenger-readiness.test.ts tests/messenger-inbox.test.ts tests/windsor-reporting.test.ts tests/windsor-boundary.test.ts tests/route-role-access.test.ts` — 5 files / 51 tests passed, exit 0, 23:05:06 UTC. Harness build OK 23:04:57 UTC. Browser attempt blocked all external/backend requests and timed out awaiting the page heading; completed signed-in visual flow is unverified, not claimed passed.
- [ ] Messenger approval evidence remains unverified; live activation blocked by reviewed storage, App/Page approval and signed webhook setup. No live calls, migration or deployment performed. Changed: `src/lib/integration-readiness.ts`, `src/routes/messenger-setup.tsx`, `src/routes/messenger.tsx`, `tests/messenger-readiness.test.ts`, `tests/messenger-inbox.test.ts`, `AGENTS.md`, `docs/MESSENGER_SETUP.md`, `roadmap.md`; latest owner preference supersedes previous progress-page closure.

## 2026-10-24 — Close progress page / requested real Messenger sync
- [x] Closed `/messenger-setup` with a redirect to `/messenger`, removed its entry link, and redirected human webhook navigation to the inbox. Support Desk, disconnected notice, Android sync, roles and data unchanged.
- [ ] Real-message sync blocked: handler is still a 503 placeholder, offline signature helpers are not wired, stored-message ownership/receipts are absent, App/Page approval and webhook configuration remain unverified. Existing no-production/schema/secrets/deployment safeguards remain; no live Meta call, callbacks accepted or messages imported.
- Verification: `bunx vitest run tests/messenger-inbox.test.ts tests/messenger-protocol.test.ts tests/messenger-readiness.test.ts tests/support-inbox-agent-scope.test.ts tests/route-role-access.test.ts` — exit 0, 5 files / 56 tests passed at 23:02:22 UTC. Harness build OK 23:02:18 UTC. Redirect and fail-closed callbacks tested offline; authenticated UI and live Facebook sync not verified. Changed files: `src/routes/messenger-setup.tsx`, `src/routes/messenger.tsx`, `src/routes/api/public/meta/messenger.ts`, `tests/messenger-inbox.test.ts`, `docs/MESSENGER_SETUP.md`, `AGENTS.md`, `roadmap.md`.

## 2026-10-24 — Messenger tab inside /inbox
- [x] `src/routes/inbox.tsx` now mounts Support Desk and shared Messenger in separate tabs, selected queue only; existing support query/actions unchanged. Updated route metadata. `src/components/crm/MessengerInbox.tsx` shows disabled reviewed-lead action and explains customer details/consent, confirmation and unassigned LeadHub destination; no new intake call or fake lead.
- [x] `bunx vitest run tests/messenger-inbox.test.ts tests/support-inbox-agent-scope.test.ts tests/route-role-access.test.ts tests/integration-boundaries.test.ts` — 4 files / 40 tests passed, exit 0, 23:00:35 UTC, 801ms. Automatic harness build OK 23:00:30 UTC. No production data reads/writes, deployment, schema, settings or secret changes. Authenticated UI flow not exercised under current production-read boundary; not claimed live-verified.
- [ ] Actual reviewed Messenger-to-lead conversion blocked by missing verified connection and durable real-message ownership/dedupe; implement canonical intake only after separately approved storage/setup. Samples cannot create leads and new messages are not claimed imported. Changed files: `src/routes/inbox.tsx`, `src/components/crm/MessengerInbox.tsx`, `AGENTS.md`, `roadmap.md`; preferences saved in project memory.

## 2026-10-24 — Live Messenger request / remove phone guidance
- [x] Removed `PhoneSyncGuide` and Desk-phone link from `src/routes/messenger-setup.tsx` and updated its metadata, per owner clarification; Desk guide and Android call/report/recording sync unchanged. No provider/auth/data/secret/deployment change.
- [x] `bunx vitest run tests/messenger-readiness.test.ts tests/messenger-inbox.test.ts tests/messenger-protocol.test.ts tests/route-role-access.test.ts` — exit 0; 4 files / 50 tests passed, 22:46:12 UTC, 561ms. Automatic harness build OK 22:46:07 UTC. Source check confirms PhoneSyncGuide remains on Desk, absent from Messenger routes; no authenticated production flow attempted.
- [ ] Live Messenger remains blocked pending verifiable App/Page approval, signed webhook configuration, reviewed durable storage/ownership implementation and separately authorized deployment/schema changes. Existing demo is not a connected Page; do not fabricate live messages or accept callbacks without durable processing.

## 2026-10-24 — Windsor.ai read-only preparation + audience outreach
- [x] Implemented `/facebook-ads` authority-only disconnected preparation and manual full-IT-PIN-only server configuration-presence boundary; no provider/DB calls, secrets changes or deployment. A configured key cannot enable the adapter; no fabricated metrics, campaign/budget actions, exports, schedules or storage.
- [x] `bunx vitest run tests/windsor-reporting.test.ts tests/windsor-boundary.test.ts tests/route-role-access.test.ts tests/integration-boundaries.test.ts tests/messenger-inbox.test.ts tests/social-moderation.test.ts tests/support-inbox-agent-scope.test.ts` — exit 0, **7 files / 65 tests passed**, 22:42:52 UTC, 656ms. Includes 18 Windsor tests: 1–31 inclusive days, strict calendar dates/fields/timezone, full-PIN-only configuration inspection, disconnected with/without config, no network calls and no extra response properties. Handler tested offline with synthetic config only; production secrets never inspected. Earlier 6-file run: 59 passed. Automatic harness build OK 22:42:44 UTC; no manual build/typecheck (harness handles both). All content-route metadata present, including index and new route.
- [x] Researched six public destinations with audience-fit/rule caveats and one draft each: Bproperty, BangladeshYP, Property Land, LandShareBD, B/deshi, NRB Forum. Saved URLs, drafts, moderator requirements and unverified eligibility in `docs/WINSTONE_AUDIENCE_OUTREACH.md`. No external posting/account access; property-listing drafts need actual verified property details; no inferred traffic/customer membership claims.
- [x] Uploaded HTML inspected as inert headings only; scripts/token fields never executed/copied/imported. Pasted `/me` id/name does not establish App/Page approval, ad-account scope or Windsor reporting access.
- Changed: `src/lib/windsor-reporting.ts`, `src/lib/windsor-reporting.functions.ts`, `src/components/crm/WindsorReporting.tsx`, `src/routes/facebook-ads.tsx`, `src/components/crm/AppShell.tsx`, `src/components/crm/NavSidebar.tsx`, `src/lib/i18n.ts`, `tests/windsor-reporting.test.ts`, `tests/windsor-boundary.test.ts`, `tests/route-role-access.test.ts`, `docs/WINDSOR_AI_SETUP.md`, `docs/WINSTONE_AUDIENCE_OUTREACH.md`, `AGENTS.md`, `roadmap.md`; plan archived after approval. No unrelated work overwritten.
- Browser attempt: `python3 /tmp/browser/windsor-preparation/check_page.py` — URL/title resolved, all account/API/provider requests intercepted/aborted (9); no credentials restored and no production DB access. Screenshots showed account-loading skeleton followed by shared module-recovery notice, **not the completed reporting UI**; signed-in/mobile central flow is unverified under the no-production-read boundary. No claim of visual/E2E completion. Unit tests and automatic build passed.
- [ ] Real reporting blocked: owner must revoke exposed key, later save replacement only as `WINDSOR_AI_API_KEY` in Project Settings → Secrets, verify intended account/read permission and official Windsor endpoint/auth/schema/pagination/quotas/currency/timezone, then separately authorize isolated read testing/activation. No new migration file needed or executed. Auth/roles/RLS/settings/secrets/production data unchanged; no live Meta/Windsor calls or deployment.

## 2026-10-24 — Disabled webhook browser navigation recovery
- [x] Reproduced direct browser navigation returning intentional 503 JSON. Added 303 setup redirect only for HTML GET without hub.* parameters; verification/machine GET and all POST still refuse with 503. No provider/storage/auth/secret change.
- [x] `bunx vitest run tests/messenger-inbox.test.ts tests/messenger-protocol.test.ts tests/messenger-readiness.test.ts` — 3 files / 33 tests passed at 22:20:51 UTC. Repeated `python3 /tmp/browser/webhook-recovery/reproduce.py`: same direct navigation now ends at /messenger-setup, HTTP 200 instead of 503; verification remains refused in regression cases. Harness build OK 22:20:45 UTC; no deployment.

## 2026-10-24 — Messenger progress + Facebook-independent phone sync
- [x] Added /messenger-setup progress page linked from Messenger: unverified App/Page, disabled webhook, demo inbox, explicit activation blockers; no fabricated progress percentage/provider errors or secret values. Status is preparation-only, not a live check.
- [x] Confirmed phone sync already independent via Android CallSyncQueue/device-token endpoints; added PhoneSyncGuide beside existing Desk SIM setup and on progress page. No queue, SIM, account/briefing or authorization logic changed.
- [ ] Requested live Messenger activation remains pending verified App/Page permissions, app secret/verify token, reviewed storage and separately authorized deployment/migration; do not bypass missing prerequisites.
- [x] Meta Ads / WhatsApp connector mentions inspected: list_connections returned empty at 22:19 UTC; neither linked by this task. Mentions are not proof of successful connection or Messenger permissions. WhatsApp Business changes would be a separate provider setup, not needed for existing personal-phone sync; no callback routing changed.
- Tests: `bunx vitest run tests/messenger-readiness.test.ts tests/messenger-inbox.test.ts tests/messenger-protocol.test.ts tests/route-role-access.test.ts tests/desk-and-cache.test.ts tests/sync-diagnostics.test.ts tests/android-api-compatibility.test.ts` — 7 files / 78 tests passed at 22:19:08 UTC, 1.58s. Harness build OK 22:19:03 UTC. Secret names only checked: Page token/ID set; App ID/Secret/verify token not configured; values never accessed. No production data/SQL/migration/deployment/provider call/secret change.
- Browser: `python3 /tmp/browser/setup-progress/check_progress.py` passed: desktop/428px screenshots inspected, disconnected + two unverified approvals, no mobile horizontal overflow, webhook 503; no credentials restored. Changed files: `src/lib/messenger-readiness.ts`, `src/components/crm/PhoneSyncGuide.tsx`, `src/routes/messenger-setup.tsx`, `src/routes/messenger.tsx`, `src/routes/desk.tsx`, `tests/messenger-readiness.test.ts`, `tests/route-role-access.test.ts`, `AGENTS.md`, `roadmap.md`. Actual signed-in phone sync remains handset-dependent and unverified in this turn.

## 2026-10-24 — Encrypted Meta Page secret storage
- [x] Owner saved `META_PAGE_ACCESS_TOKEN` and `META_PAGE_ID` through the secure form into Lovable Cloud's encrypted secret store; tool confirmed both set, no values exposed. No available workspace connection; uploaded credential material not reused and no Facebook password requested. Adapter/endpoint remain disconnected; no deployment/SQL/data/auth changes. Updated `docs/MESSENGER_SETUP.md` and `roadmap.md` only; no runtime code changed, no tests necessary for managed secret creation. Token validity/Page association/App approval remain unverified; no Graph call performed.

## 2026-10-24 — Local sensitive-file masking
- [x] Added local TXT sanitization and download tool on /messenger; whole sensitive lines/next values and token-like strings/long IDs masked, no raw preview or file upload/storage. Original uploaded credentials not copied or read.
- [x] `bunx vitest run tests/credential-redaction.test.ts tests/messenger-inbox.test.ts tests/messenger-protocol.test.ts` — 3 files / 35 tests passed, 21:49:45 UTC. Automatic build OK at 21:49:33 UTC. `python3 /tmp/browser/redaction/check_redaction.py` — synthetic file downloaded with all three sensitive lines fully masked; Clear disabled download; 428px screenshot inspected, no original credentials used. Automatic detection is conservative, not guaranteed for arbitrary unlabelled passwords; review before sharing.
- Changed: `src/lib/credential-redaction.ts`, `src/components/crm/CredentialRedactor.tsx`, `src/routes/messenger.tsx`, `tests/credential-redaction.test.ts`, `AGENTS.md`, `roadmap.md`. No database, secrets, auth, provider connection or deployment change; read-only uploaded original remains untouched.

## 2026-10-24 — App verification / Messenger + Lead Ads preparation
- [x] Inspected recent foundation and prior plan/service/guide/tests; extended existing setup guide with App verification and credential/permission matrix for Messenger, Webhooks and Lead Ads. Preserved UI, service, reply function, endpoint and unapplied proposal; added offline duplicate-parameter/challenge-boundary tests only.
- [x] Exact changed files in this follow-up: `docs/MESSENGER_SETUP.md`, `tests/messenger-protocol.test.ts`, `roadmap.md`. No runtime secret reader/readiness endpoint added: a guide update is sufficient and avoids implying that configuration presence establishes provider verification.
- Checks: `bunx vitest run tests/messenger-protocol.test.ts tests/messenger-inbox.test.ts tests/route-role-access.test.ts tests/desk-and-cache.test.ts tests/social-moderation.test.ts tests/support-inbox-agent-scope.test.ts tests/integration-boundaries.test.ts` — exit 0, **7 files / 65 tests passed**, 21:48:08 UTC, 1.48s. Protocol tests: 18 passed. Automatic harness latest checked **build OK** at 21:48:03 UTC; no manual build/typecheck.
- No secret request/change, provider connection, live Graph call, SQL/migration, production data query/change, settings/auth/role/RLS change or deployment in this follow-up. Prior secure-form attempt was unavailable and did not run; no credentials saved. Uploaded sensitive material not copied/reused. Earlier secret-name listing was before this new prohibition; no new secret inspection was performed.
- [ ] Owner actions blocked/pending: verify existing Meta app or separately authorize creation; verify correct Business/Page/form and app access/review/lead-access rights; approve privacy/retention; configure credentials only via authorized project secrets UI; arrange isolated testing and separately review storage/migration/enablement. Webhook remains 503, not connected. Real Messenger delivery and Lead Ads imports are neither enabled nor verified.

## 2026-10-24 — Continue disabled Meta/Messenger integration
- [x] Safe code-only: fixed mobile list/back selection logic, added role-scoped demo search/status filters and accessible design-system controls. Added offline webhook HMAC/challenge and reply-policy preflight helpers; all provider operations remain disabled and helpers are not wired to webhook/send.
- [x] Current evidence and precise owner setup checklist recorded in docs/MESSENGER_SETUP.md. Meta App/permissions/Page consent are unverified, not assumed missing or connected. No credentials inspected, Graph calls, SQL, database writes, secret/settings changes or deployment.
- Exact changed files: `AGENTS.md`, `roadmap.md`, `src/components/crm/MessengerInbox.tsx`, `src/lib/messenger-shared.ts`, new `src/lib/messenger-protocol.server.ts`, new `tests/messenger-protocol.test.ts`, new `docs/MESSENGER_SETUP.md`. Historical plan, service/reply function, webhook placeholder, migration proposal, Support Desk and social integration untouched.
- Tests: `bunx vitest run tests/messenger-protocol.test.ts tests/messenger-inbox.test.ts tests/route-role-access.test.ts tests/desk-and-cache.test.ts tests/social-moderation.test.ts tests/support-inbox-agent-scope.test.ts tests/integration-boundaries.test.ts` — exit 0; **7 files / 63 tests passed**, 21:42:17 UTC, 1.21s. New protocol/filter tests: 16 passed. Latest automatic harness build checked: **build OK**, 21:42:12 UTC; no manual build/typecheck. All 55 content-route metadata sets checked, none missing.
- Browser: `python3 /tmp/browser/messenger-disabled/check_disabled.py` — exit 0; real local GET and POST webhook return **503 FACEBOOK_NOT_CONNECTED**. Signed-out `/messenger` renders staff-sign-in denial (screenshot inspected); no credentials accessed/restored. Authenticated mobile list/thread/back/search flow **not end-to-end verified** under the no-browser-credentials boundary; code logic and scoped filtering unit-tested, not claimed handset-verified.
- [ ] Full integration blocked by explicit no-connection/no-API/no-schema boundaries and separately approved owner setup: app/Page access and permissions verification, encrypted token configuration, isolated test backend/Page, reviewed grants/append-only/transaction migration and explicit enablement approval. Existing HQ-granted agent own-work scope and LeadHub PIN assignment routing need a separate reviewed design; no rights changed here. Proposal stays **UNAPPLIED** and incomplete (append-only triggers TODO).

## 2026-10-25 — Privacy-safe sync diagnostics (code only)
- [x] src/lib/sync-diagnostics.ts + Android SyncDiagnostics.kt: allow-listed redaction (fingerprinted call/checksum, no phone/name/audio/transcript/token), failure-reason classifier with bn/en copy, report-vs-audio state (pending until matching ack), idempotent call-UID reconciliation flagging conflicts. tests/sync-diagnostics.test.ts passes. No schema/data change.
- [ ] Not yet wired into Android workers/IT Console display; Kotlin test blocked (no Java in sandbox).

## 2026-10-24 — Facebook Messenger inbox foundation (code only)
- [x] /messenger Bengali-first UI, role-scoped (agents own only; authority sees unassigned; HQ read-only), clearly labelled demo samples; Support /inbox untouched.
- [x] Not-connected service stub, reply server fn and /api/public/meta/messenger placeholder (503 FACEBOOK_NOT_CONNECTED); no secrets/DB/Meta calls.
- [ ] Blocked (manual): Meta Business verification, App + App Review (pages_messaging etc.), Page admin consent, secrets, review/apply docs/proposals/messenger-inbox-migration.UNAPPLIED.sql.

## Follow-up — resume code-only remediation
- [x] Further requested execution: malformed blocker intervals/reasons and self-referential history links now require review, not validated employee fault; added six isolated fairness cases, including KPI exclusion and a valid out-of-window block that does not excuse overdue work. Execution tools available, no approval refusal encountered; workspace credit balance not queried. No deployment or database writes.
- Fairness follow-up command: `bunx vitest run --exclude 'tests/*.integration.test.ts' --exclude 'tests/project-photo-access.test.ts' --exclude 'tests/rls.test.ts' --exclude 'tests/staging/**'` — initial run 779 passed / 1 prior expectation failed; updated the prior test to require unresolved-evidence review. Final run exit 0, **112 files / 780 tests passed**, 20:10:12 UTC, 5.64s. Android, genuine handset, historical evidence and transaction/deep-scan blockers below remain open; no live business reads or writes.
- [x] Extracted Android server-confirmation predicate into testable queue logic and connected upload handling to it; rejects missing/blank identities, blank/mismatched checksums and non-uploaded statuses before durable original release. Added one Kotlin test and three executable TypeScript tests.
- Follow-up regression: `bunx vitest run --exclude 'tests/*.integration.test.ts' --exclude 'tests/project-photo-access.test.ts' --exclude 'tests/rls.test.ts' --exclude 'tests/staging/**'` — exit 0, **111 files / 774 tests passed**, 20:08:29 UTC, 7.19s. No deployment or database writes; Android runtime tests remain blocked on Java/SDK and a genuine handset.
- Commit creation is managed by Lovable; this agent does not run git commit/push. Source and tests from the previous pass are present.

## 2026-10-25 — Production-safe audit remediation (code only)
- [x] A. Code-only pass: physical call UID propagated through Android lifecycle/audio/report; existing owned recording reused with checksum comparison, cross-call content rejected, stored/available normalized, lifecycle replay cannot erase terminal evidence, durable file queue retains audio until matching server acknowledgement. Audio upload no longer counts as a dial/connected outcome; STT/AI cannot mark upload verified. Real recovery/handset testing remains blocked below.
- [x] B. Code-only pass: inactive/pending/rejected account and SIM-invalid/conflict responses distinct; legitimate IT recovery surfaced in Android and web. Existing briefing, maintenance, HQ/IT/PIN gates unchanged; recovery hints never authorize access. Four isolated phone-login refusal tests pass.
- [x] C. Code-only pass: LeadHub unassigned queue and real active approved roster shown; preview actual eligible oldest-first deduplicated candidates; confirmation refuses changed IDs before writing; existing history/audit retained with reviewed IDs. No assignment or live query was performed.
- [x] D. Code-only pass: deterministic six-class overdue evidence helper integrated into new accountability measurements; only validated overdue counted for follow-up fault; invalid/late-created or uncertain ownership excluded. Query/truncation failures no longer become zero evidence. Original history/reviews preserved. Historical blocked intervals and all other fault surfaces remain unverified below.
- [x] E. Field dictionary + exact Asia/Dhaka calendar/rolling-period distinction documented in docs/AUDIT_REMEDIATION_CODE_ONLY_2026-10-25.md; report/feed read timestamp and separate Android audio/report confirmation times surfaced; existing pipeline sample-limit warning retained.
- [x] F. Final isolated regression command: `bunx vitest run --exclude 'tests/*.integration.test.ts' --exclude 'tests/project-photo-access.test.ts' --exclude 'tests/rls.test.ts' --exclude 'tests/staging/**'` — exit 0, **110 files / 771 tests passed**, 2026-10-24 20:06 UTC, 9.99s. No live business data or external AI/Drive calls.
- Targeted first command: `bunx vitest run tests/audit-remediation.test.ts tests/recording-recovery.test.ts tests/accountability.test.ts tests/android-api-compatibility.test.ts tests/lead-quota.test.ts tests/lead-daily-cap.test.ts tests/agent-briefing.test.ts tests/briefing-controlled-dates.test.ts tests/command-center.test.ts tests/maintenance-integration.test.ts tests/readonly-workspace-endpoints.test.ts tests/assigned-lead-scope.test.ts` initially 101 pass / 1 legacy response-key failure; repaired response compatibility. Expanded targeted run adding `tests/assignment-preview-server.test.ts tests/call-audio-server.test.ts` passed **14 files / 110 tests**; final full suite above supersedes counts. `bunx vitest run tests/phone-login-recovery.test.ts` — **4/4 passed**.
- [ ] Android tests: `./gradlew :app:testDebugUnitTest --offline` (cwd android) — exit 1: JAVA_HOME unset / Java absent. Added three Kotlin queue identity/checksum tests; run with JDK + Android SDK before APK release. No APK built/distributed.
- Automatic harness typecheck/build is **build OK** (latest checked 20:05:56 UTC; checked again before conclusion). No manual `bun run typecheck`/`bun run build` executed: project harness runs both automatically. Content-route metadata inspected: all 54 content route files contain head/title/OG/description/card metadata, including index/desk/leadhub.
- [ ] Real device/audio recovery, ID backfill, Drive confirmation, live ownership/51st-lead/payment/RLS/mutation E2E — BLOCKED: requires genuine authorized handset/input + isolated staging/approval; prohibited on shared production DB in this pass. Existing audio not recovered and coverage improvement not claimed.
- [ ] Complete historical system-block windows / all historical fault KPI reconciliation — BLOCKED: authoritative historical evidence is incomplete; old reviews and coaching summaries remain unchanged, no invented excuses. Missing evidence is review/ownership uncertain; raw operational overdue is not employee blame.
- [ ] Atomic checksum uniqueness and assignment+audit transactions — BLOCKED: require separately reviewed schema/transaction change; no migration here. Existing unique call/upload keys and conditional writes retained; partial assignment-history failure requests IT review, not blind retry.
- [ ] Open service-bill deep-scan report — unchanged intentionally retained staff bill notice; no financial enforcement/access bypass change. Fresh built-in deep scan requires owner **More → Security → Run deep scan**; no current deep certification.
- No deployment/publication, DB/schema/data mutation, SQL, user creation, secret disclosure, live business reads or AI-credit use. Same-scope follow-up request received 19:58 UTC was folded into this pass without restarting.
- Backend readiness checked only: Lovable Cloud auth/database responding normally; no business data queried.

## Active
- [x] HQ WhatsApp agent summary date range and filtered formula-safe CSV implemented: 21 targeted tests pass, harness build OK; signed-in preview selects Oct 13–19/reset, desktop/428px checked without errors/overflow. Existing feed empty; populated totals/export unit-tested, no customer writes or access changes.
- [x] HQ WhatsApp range/CSV published to crm.winstonebd.com: fresh signed-in live HQ selects Oct 13–19 and resets to all dates, export correctly disabled on empty feed; desktop/428px screenshots confirm controls, no page errors or overflow. Populated CSV covered by regression tests, not fabricated live rows.
- [x] HQ stale/missing-prop crashes reproduced in three failing render tests, then fixed: absent metrics show loading (no fabricated zero totals), null snapshot arrays do not crash and missing WhatsApp data shows unavailable. Nine regression tests pass; signed-in HQ default/date/agent filters and phone view checked without page errors; build OK. Not published.
- [x] HQ screenshot mismatch reconciled in preview: both summaries share one filtered command-center result; 4,863 leads, 2,343 non-pending/worked leads (not claimed connected), 814 current follow-up items, 498 overdue and 6 booking signals for Oct 13–19. Six aggregation tests pass; signed-in own HQ default/date/agent filters checked, no page errors/phone overflow, harness build OK. No records/access changed; not published.
- [x] WhatsApp attempt Dhaka date/agent/status filters and formula-safe filtered CSV published 2026-10-19; support agent escalation requires ownership (conditional update guards reassignment). 57 targeted tests pass; harness build OK. Live signed-out bill denial and signed-in bill/customers/HQ/Reports HTTP 200, release-specific filters/reset and empty-export disabled verified with zero page errors. Real feed empty: populated export unit-tested only. Basic scan clear; deep rescan unavailable. Agent-scoped read test refused current admin session; real agent escalation/score submission not live-tested. No customer writes or permission grants changed.
- [x] HQ overview WhatsApp agent summary published 2026-10-19 using the existing latest-300 attempt feed: attempts, submitted/pending reports and latest attempt. Two aggregation tests passed; harness build OK; own-account desktop/428px preview and live HQ verified. Current real feed is empty, so populated rows are unit-tested only; no live data or permissions changed.
- [x] Targeted security fixes published 2026-10-19: scoped support customer reads/updates/notes and escalation, authenticated AI/bill reads, server phone evidence for scored call time, read-only HQ project write guards. 122 earlier distinct targeted/regression checks passed; harness build OK. Live browser verified anonymous bill denial and own-account bill/customer reads with no page errors. No live customer writes or role-grant changes; real agent mutation/handset flow and refreshed deep scan remain unverified. Other scan findings untouched.
- [x] Published call-time and assistant-panel fixes 2026-10-18: 14 targeted checks passed; harness build OK; fresh live entry/HQ/Reports HTTP 200, signed-in data renders, no page errors, deployed assistant guard confirmed. No customer writes or fabricated report; actual handset duration submission and browser-forced empty reply remain unverified.
- [ ] Connect Wiz and run its security scan — BLOCKED: connection approval was interrupted before execution; Wiz is not connected.
- [x] Fast-loading build published 2026-10-19: self-hosted fonts (zero external font requests), prerendered gateway, charts split out of the first download. Full production build OK; published to crm.winstonebd.com and live-verified — entry page shows "IT Console" (zero "IT HQ"), Get started reaches sign-in, signed-in HQ shows 17 charts, Reports/Desk/System/Live Leads render, LeadHub still PIN-gated, no page errors or 4xx/5xx.
- [x] Recording recovery controls and safe-agent guide built in preview: original-row authentic upload, visible IDs/30-day sampled list, guarded drive/analysis retries, stale timestamp claims, saved-transcript reuse, honest Drive verification. 49 targeted tests pass; authenticated desktop/360px preview checked, no page errors or overflow. See docs/recording-recovery-verification-2026-10-18.md. Not published.
- [ ] Actual recovery upload/analysis and live report/follow-up read-back — BLOCKED: genuine phone audio and an actual agent session with approved truthful input are missing. No live customer writes.
- [ ] Actual Drive backup verification — BLOCKED: accessible connector discovery shows project-owner access unavailable; zero recording backup rows, summary flags are not recording proof. No claim that Drive recordings are backed up.
- [x] PIN failure accounting corrected and published 2026-10-18: only confirmed wrong PINs count, leases do not; 43 targeted tests pass. Actual live isolated browser: four failures then correct resets, fifth wrong pauses 5:00, reload cannot bypass, correct succeeds after five minutes. Live copilot editable instruction/quantity 25 verified. PINs never disclosed; customer counts unchanged (4863/4152/1503/753/6).
- [ ] Full live copilot agent-prefill and all-agent assignment/report/follow-up submissions need an unexpired authorized staff session and truthful input; latest live Nexus session shows no allocation agents, unlike earlier authorized preview check. No fabricated report, lead or assignment created; eight active approved agents remain unchanged.
- [x] Corrected HQ/own-agent boundary release published to crm.winstonebd.com on 2026-10-18; fresh authorized live session confirms release-specific Nexus copilot, HQ, reports and Desk HTTP 200, no page errors/5xx. Call-log entry form, own-report panel and calendar open. Counts unchanged (4863/4152/1503/753/6). Full report submission/follow-up edit remains BLOCKED: injected user is admin with no own reports/leads, needs actual agent session + truthful authorized input. See docs/hq-release-live-check-2026-10-18.md.
- [x] Free-first Winstone AI instruction copilot added to Nexus/IT: editable copy-only build requests and canonical assignment-form proposals; signed-in WIN2607 + quantity 25 verified, quota correctly prevents extra assignment, phone layout verified. No AI calls or customer writes; unpublished.
- [x] Nexus/IT vault PIN isolation corrected; live genuine Nexus and IT PIN unlock, Nexus database/history/assignment form, HQ populated reads and IT account view passed without page errors/5xx. Current live Agent session has no owned leads, so this does not verify populated agent work. Unpublished fixes.
- [x] Confirmed PIN policy implemented with atomic server guard: five failures/five-minute pause, account+surface (anonymous signed session, never shared IP), success reset, remaining-time UI. Actual isolated browser verified reset after four failures, block on fifth, reload cannot bypass, access returns after five minutes. Existing roles/PINs/customer data unchanged.
- [ ] All-agent end-to-end writes remain blocked: current session is admin, not an agent; 8 active approved agents and 2 inactive/rejected profiles audited read-only, but each real agent session and truthful staff/customer test target requires authorization. No impersonation or fabricated reports. Corrected HQ/own-work release published 2026-10-18.
- [x] Protected live reads: signed-in Desk/follow-ups/HQ and genuine LeadHub PIN unlock + canonical database/history verified. Preview fixes HQ-granted own-work scope and read-only write gaps; 555 tests pass, build OK. No customer changes or publication. See docs/protected-workflows-2026-10-18.md.
- [ ] Protected mutation completion: blocked by actual agent session, truthful staff daily report and authorized customer-specific test actions; corrected release published 2026-10-18. PIN throttle implemented and preview-verified in the instruction-copilot task.
- [x] Four-workspace audit recorded in docs/workspace-audit-2026-10-18.md: signed-in Agent/follow-ups/HQ populated, Nexus PIN gate intact, IT /system renders for read-only HQ with denied subpanels. No customer writes. Three write-gate risks and PIN throttling gap found; full privileged actions remain unverified.
- [x] All 10 current agent profiles have audited supplemental read-only Executive HQ grants (inactive/rejected remain blocked); no IT/LeadHub powers or ownership changes. Signed-in preview HQ/Lead360 reads 4,863 leads; 546 tests pass. Customer counts unchanged: 4,863 leads / 4,152 reports / 1,503 follow-ups.
- [x] Immutable overdue/missed recovery and API ownership checks/tests implemented. Monisha WIN2604 live read-only API checks pass across six activity tables; foreign history refused, LeadHub agent denied. No customer mutations; 1,503 follow-ups remain, zero recovery actions created by testing. Authorized LeadHub content/recovery submission blocked by PIN and mandatory staff contribution gate.
- [x] Existing follow-up reconciliation: 1,503 records checked; no missing lead/agent/schedule/correlation IDs. 498 overdue are derived by new readers, not silently rescheduled. 689 historical completions lack recorded outcomes and 29 lack report links: preserved without fabrication. Legacy creation keys remain absent because originals are immutable; no bulk data mutation needed for current rule enforcement.
- [x] HQ/recovery changes published 2026-10-18: fresh https://crm.winstonebd.com home and signed-in Monisha HQ return HTTP 200; HQ shows charts and 4,863 leads without a PIN, no page errors. Release-specific live HQ grant confirmed. Full mutation/LeadHub verification still blocked by contribution form/PIN; audit write-gate/PIN risks and project-photo warning unresolved. This documentation-only update follows publication.
- [x] Canonical follow-up lifecycle: mandatory outcomes/reasons, linked replacement on reschedule, completion never closes leads, current-owner checks, immutable original tasks/history, idempotent atomic transitions, clickable health filters and scoped dossier history. 522 tests / 75 files pass; harness typecheck/build OK; original 1,503 follow-ups unchanged.
- [ ] Follow-up recovery submission and LeadHub import/assignment verification — BLOCKED: genuine staff contribution and customer-specific test authorization. LeadHub PIN unlock/database/history live now verified; no fabricated report or customer recovery submitted.

- [x] Full-system presentation polish: shared controls, readable tables, wrapped headers, dialog spacing, mobile touch sizes, flat welcome panel; 506 tests pass, recovery check and harness build OK. Signed-in HQ/IT/Desk/audit/reports verified at 1280/768/360px; LeadHub private content and populated agent-only workflows remain permission-gated. No data mutations or publication.

- [x] Global unified palette: one inherited token set, shared black actions/white forms, flat decoration and semantic statuses; global color check and 503 automated tests pass, production build OK; 48 static paths and four responsive widths checked. Signed-in HQ/IT/Desk checked with own account; LeadHub PIN-protected content and agent-only populated views remain unverified without the relevant authority/session. No backend changes or deployment.

- [x] Replace sideways desk navigation with a colour-accented, non-scrolling section picker; mobile global menu opens from below. Browser verified, no overflow.
- [x] Bring saved notes and prior reports/history into pre-call and active web-call workspace using existing authorised paths; 11 targeted checks passed. Signed-in saving remains unverified.
- [ ] Full SIM mute/speaker/hang-up verification blocked: browser has no telephony bridge; existing Android controls require a real authorised phone/device test. Web labels explicitly distinguish phone controls from opening the report.
- [x] Connect Android in-call service source for real SIM controls with opt-in default-phone role; existing reporting paths unchanged. APK compilation and handset behaviour unverified: JDK/Android SDK unavailable.
- [ ] Verify signed-in notes survive reopening the call panel and previous history is visible: blocked because requesting-user auth-session mint found no matching app account; needs authorised preview sign-in.

- [x] Phone-like agent calling panel — centered customer identity, round secondary controls, large call button; existing gates preserved. Signed-in visual check blocked: no requesting-user staff session available.

0. **Knowledge Hub link** — Done in CRM: hub project pages + citations in answers, official news highlighted/pinned + Desk strip, website visit requests (confirm/dismiss). Waits on Hub sending `site_visit.requested`.
0. **UI polish batch** — sidebar/top bar; dashboard KPI cards & charts states; lead list badges/states; follow-up & call screens. Frontend only.
0. **Restart module-load blank screen** — verify/fix without changing the 2.25.2 pin.

0. **Premium dashboard UI (master brief)** — Phase 1 done: light navy/gold theme on all app screens, WCAG contrast fixes, CI color check. Next, one screen at a time: menu/top bar, main dashboard cards & charts, lead list, follow-ups/calls/reports. Frontend only.
0. **Project selection + price details for agents** — Waiting on user answers: project source, price fields, who edits prices, how sales update links to bookings.



0. **Lead Details new layout** — header + quick actions, Brief Me, Reports, Personal Notes, Timeline, original lead description kept.
0. **Unified OS+CRM billing/entitlement** — Pending: renewal 12th, notices from 9th, lock 11th 23:49 Dhaka if unpaid, October 2026 paid (needs IT-recorded verification), website never locked, shared global unlock across OS/CRM, scoped notification center (executive_hq/it_council/agent), Hostinger role templates. Blocked parts: shared OS entitlement contract/endpoint, recipient mappings.
0. **Service-bill test email + PIN unlock check** — BLOCKED: `NOTIFY_EMAIL_ENDPOINT` must be a valid HTTPS relay and sender `info@winstonebd.com`, saved by the user in secure settings.
0. **Public MCP bill submission** — Declined: bills are private financial data; review stays on authenticated `/service-bill-unlock`.
0. **Billing workflow recipients** — Recorded: HQ alerts → info@winstonebd.com, IT alerts → winstomeitteam@gmail.com; Paid needs payment reference; Architect approve → unlock. Build pending with the unified billing task; OS Architect URL not yet provided.
0. **OS booking sync** — Inbound idempotent receiver done. Outbound CRM→OS dispatcher built (signed v1 payload, atomic claim, 1m/5m/15m/1h/4h backoff, max 5, manual retry, IT Console status panel, cron hook). BLOCKED until `OS_BOOKING_ENDPOINT` (https) is saved; no schedule set yet.
0. **Lead Details mobile** — Done: shortcut grid fits 390px, no sideways overflow, timeline rows wrap cleanly.
0. **Authorized bill review workflow** — Existing: IT verify needs payment reference, unlock request → System Architect (Google + server secret) approve, in-app HQ/IT alerts, append-only audit; no payment execution. Email alerts wait on Hostinger relay config.
0. **Review-only Service Bill Alert** — Implemented and verified locally: `/service-bill-alert` and authenticated `/service-bill-unlock`, server-only PIN and approver-email gates, persistent throttling/audit, safe Hostinger test send, and no payment execution or financial approval. Not published.
0. **Winstone ecosystem integration completion audit** — Completed credential-independent hardening: public-route flood brakes, provider payload replay guard, transactional booking→OS outbox, booking audit events, private MCP tool isolation, booking RLS regression, booked-value wording, and trigger-function hardening. Outbound OS dispatch remains blocked on a real OS endpoint contract; external providers remain configuration-gated.
   - Hostinger service-bill sender: verify `info@winstonebd.com`; current endpoint test is BLOCKED because saved `NOTIFY_EMAIL_ENDPOINT` is not a valid URL.
   - Phone OTP: custom Bangladesh SMS hook, 6 digits, 300 seconds, auto-confirm off; CONFIGURATION REQUIRED until a real gateway and credentials exist.
   - Connector-backed services: connect only with real workspace authorization; otherwise report CONFIGURATION REQUIRED without blocking CRM/OS core.
1. **Phone-friendly CRM tables** — Completed: high-use lead, support, performance, accountability and synced-call tables now become compact phone cards while retaining full laptop tables; remaining wide tables use contained touch scrolling.
2. **Google Drive reconnection** — Completed: linked a fresh Google Drive account in the new workspace; verified folder reads and a write/delete probe in the CRM archive (probe file removed).
3. **Search results show report description** — Completed: Lead 360 search rows and its call timeline render the shared expandable report card (manual description + structured fields), and exports carry the last report date/description.
4. **Mobile check of lead details + Personal Notes** — Completed on a 390px phone: Overview, Personal Notes, reports and timeline all present; notes composer and full-report expansion work. Fixed a clipped sheet header (24px cut off the right edge) in LeadDossier, AgentDossier, HqDrillSheet and NavSidebar, enlarged the sheet close target, and raised the brief/note/expand buttons to touch size.
5. **LeadHub Nexus consolidation** — Completed: Coordinator entry removed; dedicated PIN-only canonical database, import, quality, oldest-first quantity assignment and safe `/dispatch` redirect added.
6. **Correct agent performance analysis** — Use actual call duration/connected status/outcomes from `call_reports`/`calls`/`recordings`, not report submission counts. Identify who is actually wasting leads (short/no-answer/fake reports) vs genuinely working them.
7. **Google Sheets reconnection** — Pending; user paused to fix report logic first.
8. **Follow-up priority** — Completed: Hot/Warm/Cold-derived priority and overdue/due/category ordering across server reminders and web views.
9. **System update report** — Completed: factual IT update history from persisted app release notes.
10. **IT Council notice board** — Completed: IT publishing to all/role/accounts, recipient inbox, read state, replies, web realtime, push and Android notification feed.

## Backlog

3. Revisit Google Sheets connection after report is accepted.

## 2026-09-30 request (pending answers)

- [ ] Lead brief per assigned lead: why given, value, call script, conversion tips, callback date
- [x] Inventory-based per-project daily/monthly report: leads, calls, explicit site-visit signals, closed/converted bookings
- [ ] APK nearby-lead cards (blocked: sign-in cannot be removed — security)
- [x] Locked V2 scoring (6 questions, auto category/priority, no manual Hot/Warm/Cold) — web/server/Android
- [x] 9:05 daily briefing acknowledgement gate (server-side, web + Android popup)
- [x] Android foreground-only nearby-lead sorting from saved addresses (on-device geocoding; GPS never uploaded)
- [ ] Smarter distribution: project expertise, site visits, prior follow-ups
- [x] V2 six-question scoring on web/server/Android (version 2.13 mandatory release published)

## Open — Daily performance engine (rules locked 2026-09-30)

- [ ] Capped weighted KPI performance %, separate compliance state
- [ ] Deterministic 5:30 PM Top 3 from stored snapshot
- [ ] 6:00 PM Dhaka finalization lock + admin correction with reason/audit

## 2026-10-02 — Winstone Sales Success build (in progress)

- [x] Reconnect Google Drive in new workspace (linked; gateway-backed)
- [ ] Reconnect Google Search Console — BLOCKED: no workspace connection exists; user must create it in Connectors settings, then agent links it
- [x] Sales Success operating loop: Sales Copilot (FACT/INTERPRETATION/RECOMMENDATION, bn/bnlish/en, one next question) in sales-intel.server.ts + rules; Property Match from verified project_property facts with honest empty state; Objection Library (agent section + trust/ready_property codes); HQ overview daily market brief + property/project updates; NRB/expat news category + query; 288/288 tests, typecheck clean, build OK. Not published; AI answers and property match not exercised against live facts (market_facts empty).

- Ingest leads: non-device inbound records land unassigned (no round-robin, payload agent_id ignored); OS receiver rate-limited 120/min/IP — verified 2026-10-03, 301/301 tests.
- Evaluation audit: every V2 report submit appends immutable lead_events "evaluation_recorded" (rule version, raw answers, score, category, priority, report/call/agent ids, time) — verified 2026-10-03, 302/302 tests, build OK.
- Locked KPI rule module (src/lib/daily-kpi.ts): 50/50 capped, locked tie-break chain, 17:30 snapshot / 18:00 final phases — tested 305/305. OPEN: wire into Top 3 board + immutable 18:00 snapshot table (needs migration approval).
- Unified bridge lead_ingested on /api/public/os/events (Bearer or HMAC, 409 duplicate_ignored, 422 validation, unassigned canonical intake) — docs/crm1-receiver.md.

- [ ] Phone OTP login (6-digit, 300s, BulkSMSBD via SMS hook, staff+role check after OTP) — blocked: BulkSMSBD API key/sender ID, approval
- [x] Charts dashboard on HQ overview + agent desk (real snapshot data)
- [x] Date-range filters on charts dashboard (আজ/৭/১৪/৩০ দিন/সব সময়/কাস্টম from-to, Dhaka dates) — typecheck clean, build OK, phone-verified on agent desk; not yet published
- [x] Review-only service-bill alert and secure human-review workflow — `/service-bill-alert` plus admin/RBAC + server-PIN `/service-bill-unlock`, immutable attempt audit, database-backed throttling, safe JSON preview, and Hostinger test-send guard. Migration 0077 applied; 327/327 tests, typecheck/build, and desktop/mobile public/signed-out checks passed. Not published; live Hostinger delivery still awaits valid relay configuration.
- [ ] Hostinger-only service-bill delivery — configure/verify the HTTPS relay, `info@winstonebd.com`, approver recipient and test delivery, then publish; sign-in and reset emails remain on the managed email system

## 2026-10-06 — OS booking relay integration audit (in progress)
- [x] Audit OS↔CRM booking relay (2026-10-06): single canonical receiver POST /api/public/os/events (HMAC ±300s timing-safe + Bearer, payload-hash idempotency in os_event_receipts, Zod strict schemas, rate-limit 120/min/IP, safe error codes only, canonical intakeLead mapping, no parallel tables); outbound sync_events outbox with 1m/5m/15m/1h/4h retry (max 5), HTTPS-only endpoint check, atomic claim, manual Send Now/Retry in IT Console. 30/30 focused tests, typecheck, build OK. Notes: inbound HTTPS relies on platform edge (outbound enforces https:// in code); inbound rate limit is per-instance best-effort; osSyncStatus health mixes bill-email checks (cohesion only).
- [ ] Report exact endpoint path, auth mechanism, required secret NAMES only, remaining configuration requirements (OS_BOOKING_ENDPOINT not yet saved — secure form couldn't open in background).

- [x] 3-day lead neglect warnings + auto-return to LeadHub pool + HQ dispute log (needs rule: may a returned lead be re-given, since worked numbers are blocked from fresh assignment)

- [x] Reconnect GitHub API in new workspace — linked "Zahid's GitHub API" (gateway-backed; scopes read:user + repo). Verified read of Winstone-BD/winstone-os and Winstone-BD/winstone-crm-v01, both private, HTTP 200. Issue creation NOT test-fired (would leave an undeletable issue in the org repo). Code sync to winstone-crm-v01 still needs the user's own workspace Git settings action.
- [x] Reconnect Google Drive in new workspace — linked "Zahid's Google Drive" (gateway-backed; drive.file + drive.appdata + drive.readonly). Verified the saved archive folder "Winstone CRM" and all seven numbered subfolders match the stored folder map, the "2026" recordings year folder and every agent folder inside it are reachable, wrote a probe file into the archive and removed it (HTTP 204).
- [ ] Sync project code to https://github.com/Winstone-BD/winstone-crm-v01.git — BLOCKED: user action only, workspace Git settings ("Connect project"); the CRM already has the GitHub API connector for booking-failure alerts, so this is code backup only.
- [x] QR code on agent login cards
- [x] One-time password reset link flow (IT Console) + forced change on first login
- [x] Live lead dashboard (HQ, LeadHub, team leaders)
- [ ] Deep code review: booking relay + Staff Portal
- [x] Marked test booking to OS
- [x] Top 3 profile photos not showing — investigate
- [x] Walk Staff Portal with real data (HQ)
- [ ] Publish
- [x] Booking admin page: HQ approve/reject before OS (needs hold step before relay)
- [ ] Deep security scan on live build

- [ ] Run production build + restart test, verify build tool pinned 2.25.2
- [ ] Google Calendar for agents (waiting on user: which kind)
- [ ] Fill 15 projects details (waiting on user data; template given)
- [x] Lock down project-images storage (public read rule replaced with signed-in-only, migration 0097)
- [ ] Google Calendar: view-only agent panel + shared Winstone team calendar + per-agent own calendar (user chose all three 2026-10-11)
- [ ] Ever-Call-Recorder (Shizuku two-sided recording) into Winstone Android app — user chose: rewrite own Shizuku-style recorder (no GPL code copied); not started

## Queue 2026-10-11 (late)
- [x] Team calendar: add confirmed site visit button (visit's agent + HQ/IT)
- [ ] Per-agent Google Calendar connection (needs workspace Google OAuth client)
- [x] Audit: persisted findings + append-only remediation timeline (HQ/IT write)
- [x] Audit: per-finding report + all-findings report (CSV/print)
- [ ] Run skipped photo checks once staff signed in; confirm HQ audit entry
- [x] Build-tool guard: block preview start if not 2.25.2
- [x] Status report: preview crash, build-tool root cause, recovery steps
- [x] Verify new leads appear in list promptly after refresh throttle
- [x] Compare one day's lead list vs call list before/after; report DB load drop
- [x] Per-call lead report auto-update alongside board
- [x] AI summaries: cache server-side, charge only first generation
- [x] Review reference images/video; assess modern dashboard redesign
- [ ] Measure DB lead-list load drop after publish (counters unchanged in preview)
- [ ] Per-agent Google Calendar connection approval
- [x] Regression test: simulated failed module import → notice, reload, fallback (bun run test:recovery)
- [x] Social media moderation (Method A): desk Social section, HQ report, pages + reply templates
- [x] Rename app: WINSTONE PULSE — The Premium Real Estate CRM · PULSE — Find. Build. Invest. (web, PWA, Android, emails, PDFs, exports)

- [x] HQ social: per page/group summary of leads, conversions, outcomes
- [x] Social pages: audit log of who changed name/link/active and when
- [x] Command Center date-range filter + clickable Leads/Calls/Follow-ups tiles
- [x] 5:20 PM Dhaka agent contribution report popup (first: since joining; then daily; ≤5 sentences, ≤120 words)
- [x] Desk honours from/to date range from Command Center tiles (chip + সরান)
- [x] HQ /contributions page: filters, summary, review (append-only), CSV
- [x] Reskin (mint/orange/teal, Outfit): tokens/sidebar/header → desk → HQ pages → entry/sign-in
- [x] Support inbox keeps last tickets during failed polls
- [x] Home: remove duplicate banner image under hero
- [x] Audit log (created/edited/archived, who, when) — awaiting plan approval
- [x] Backups: daily export, single-record restore (full restore = platform-level) — awaiting plan approval
- [ ] Reconnect Google Calendar — blocked: project owner lacks access to the existing connections
- [ ] Email domain notify.crm.winstonebd.com — waiting on DNS records at registrar
- [ ] Auto Google Calendar events for site visits + follow-ups (only real saved times/places) — blocked: Google Calendar connection not linkable (owner lacks access); also need: shared office calendar vs each agent's own
- [ ] Email .ics invite to the agent per event from notify.crm.winstonebd.com — blocked: DNS (TXT + 2 NS) not yet verified
- [x] Workspace device cards use uploaded photos
- [x] Android↔web API compatibility test (tests/android-api-compatibility.test.ts): login, report, recording upload, reminders — 7 checks pass; static source-level contract, live device flow unverified.
- [x] Gateway first download: reports board moved out of route file so charts no longer load on "/" (live Lighthouse 70, was 65)
- [x] Live "IT Console" rename verified 2026-10-18
- [ ] Recording audio recovery from agents' phones — blocked: needs agents to run phone-recorder check/upload
- [ ] 5 call reports with impossible durations (up to 234083s, no device duration) — needs HQ/IT review; data left untouched
- [x] Unit inventory JSON backup export/validate/safe-merge/full-restore (preview only)
- [ ] Unit inventory real-DB E2E: blocked — needs an isolated staging backend (preview and live share one DB)

- [ ] Connect Google Ads in the new workspace — deferred by owner: connect last, once the project is complete.
- [x] Auto Call Recorder (Android + iOS): recording, auto transcript, AI summary w/ takeaways + action items, call history, mobile/Capacitor-ready
  - Inside CRM + Winstone app; include Android APK build instructions

## 2026-10-24 — All 15 brochures as one ZIP
- [x] Projects page header offers "All brochures (ZIP, 15)": fetches the 15 brochure PDFs, packs them (stored, not re-compressed) and saves one archive; verified in browser — 18 MB ZIP with exactly 15 valid PDFs, no page errors; tests/brochure-zip.test.ts (4) passes.
- [x] Updated all 15 brochures with official sales phone 01805049666 and only info@winstonebd.com; bilingual CTA preserved, all PDF contact checks passed and strip visually checked; new versioned assets used by individual links and ZIP. Not published.
- [x] All 15 per-project brochure links verified signed-in in browser: each downloads a PDF whose title matches its project card.
- [x] Pick-and-choose brochure ZIP: "Choose projects" list; browser-verified 3-project ZIP on phone width, 7 tests pass.
- [x] All 15 brochures stamped with info@ + support@winstonebd.com and Bengali+English site-visit CTA (scripts/brochures/stamp_contact.py); no existing text covered; all 15 links re-verified.

## 2026-10-25 — Credential incidents, HQ Meta tab, guarded reply path
- [x] Credential-incident tracker: `credential_incidents` table (migration 0128, server-only, append-only via trigger), pure rules in `src/lib/credential-incidents.ts` (credential-like notes rejected), IT-gated functions, `CredentialIncidentTracker` UI.
- [x] HQ panel (audit-log) new "Meta" tab: MetaVerificationReport checklist + CredentialIncidentTracker.
- [x] Guarded Messenger reply/outbox: `messenger-reply-gate.ts` (6 blockers, bilingual) + `messenger-reply.server.ts` (gate → outbox → Meta Send API, token never logged, status-only failures); `sendMessengerReply` now requires `staffConfirmed` and refuses with blocker list until all gates clear.
- [x] Fail-closed 503→403 so the preview no longer blanks on webhook refusals; AI call history (last 10, safe fields) + retry button in HQ AI tab.
- [ ] Still blocked externally: META_APP_SECRET + META_WEBHOOK_VERIFY_TOKEN secrets, four verification tracks, audited enable decision. Reply path sends nothing until all clear.

## 2026-10-25 — Google Vertex AI provider (guarded)
- [x] Fourth AI provider `vertex` in the shared helper: service-account OAuth (vertex-auth.server.ts), OpenAI-compatible Vertex endpoint, fail-closed without GOOGLE_VERTEX_SERVICE_ACCOUNT; HQ picker option with setup-required label; 34 tests pass, build OK.
- [ ] Blocked: saved secret is currently an empty JSON object — needs the real service-account key file (client_email, private_key, project_id). Provider stays "setup required" until then. User declined the re-entry form for now.

## 2026-10-25 — Meta secrets added + Vertex key file
- [ ] Verify META_APP_SECRET + META_WEBHOOK_VERIFY_TOKEN now live (probe handshake/signature behavior).
- [ ] Replace empty GOOGLE_VERTEX_SERVICE_ACCOUNT with uploaded service-account key file (daring-pier-450522).
- [ ] Messenger sync enable decision: requires all four verification tracks verified first — record evidence, then IT enable decision.

## 2026-10-25 — Audience channel research
- [ ] Find communities/forums/directories where Winstone's audience (Bangladesh property buyers/investors) spends time; draft a post or listing for each (marketing research subagent, report in Files).

## 2026-10-25 — /goal wrap-up status
- [x] Vertex AI provider: service-account saved, live token mint verified, full suite 1035 passed / 9 skipped, build OK.
- [ ] META_APP_SECRET + META_WEBHOOK_VERIFY_TOKEN still absent from the secret store (user believes added; form declined) — webhook handshake/signature stay closed.
- [ ] Four Meta verification tracks have no evidence — enable decision blocked until recorded in HQ Meta tab.

## 2026-10-25 — AI Lead Pipeline plan (PLAN ONLY)
- [x] Design Winstone AI Lead Pipeline plan (CRM/LeadHub canonical + n8n), 8 areas, reuse-vs-missing inventory, phases, blockers. No changes.
- [ ] Meta real-message test: BLOCKED — META_APP_SECRET + META_WEBHOOK_VERIFY_TOKEN absent from secret store; enable decision also blocked on 4 unverified tracks.
- [x] Implemented plan phases 1-5,7-8: migration 0129 (lead_consent_events, n8n_event_receipts, lead_bant_scores — append-only, server-only), lead-bant.ts/.server.ts, n8n-pipeline.ts/.server.ts, /api/public/n8n/leads (fail-closed), Nexus preview showBantScores signal, 17 new tests pass, build OK.
- [ ] Enable pipeline: needs N8N_WEBHOOK_SECRET (shared with n8n) + N8N_PIPELINE_ENABLED=true after owner approves consent policy; GHL not built (needs explicit approval).
- [x] META_APP_SECRET + META_WEBHOOK_VERIFY_TOKEN saved (encrypted store, in dev env); webhook live-configured: wrong-token GET 403, unsigned POST 401.
- [ ] User: Meta Dashboard → Webhooks → Page → callback https://crm.winstonebd.com/api/public/meta/messenger + same verify token → Verify and Save → subscribe `messages` (needs publish for live URL).
- [ ] Then: 4 evidence tracks in /inbox Meta tab → IT enable decision → real-message test.
- [x] Google Sheets linked to project; Daily Lead Report sync built (lead-report-sheet.server/.functions.ts, IT Console panel on /system, day-tab mirror, formula-safe cells, metrics + audit). Verified live: tab 2026-10-25 with 500 assigned leads written and read back.

## 2026-10-25 — Daily lead hand-out filled to 50 (fixed hidden blocker)
- [x] Root cause of the silent hand-out failure (no distribution since 2026-10-23): `filter_eligible_lead_ids` re-extracted every lead's phones via a full-table `all_phones` scan per call; the per-row assignment trigger calls it too, so one 100-lead assignment batch exceeded the 8s statement timeout and the 09:10 Dhaka cron returned 500 with no run row.
- [x] Migration 0130 (applied to the live DB): phone matching now uses the indexed `lead_phone_keys` table (same eligibility rules), plus additive backfill of missing keys for 309 legacy leads. No lead data changed or deleted.
- [x] Re-ran the canonical auto hand-out (`/api/public/hooks/lead-distribution`, cron secret used in-DB only): run row 2026-10-25 completed, moved 75 (Mehedi Ashraf +50, Soniya Yeasmin +12, Sabbir Ahmmed +13), remaining pool 1,835, shortage false, duplicates 0.
- [x] Final state: all 8 active agents hold ≥ 50 leads for today (Abu Haidar 65, seven others 50). Cap/trigger and assignment ledger untouched.
