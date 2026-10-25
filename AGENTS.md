<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Lead assignment only via LeadHub Nexus (server PIN scope); imports land unassigned; claimLead retired — why: one canonical path, no quota bypass.
- agent_accountability_reviews is server-only; approval needs HQ PIN, never IT — why: Executive HQ final approval.
- 9:05 Dhaka briefing ack enforced server-side on every agent mutation (web + Android) — why: UI notices are bypassable.
- History is append-only: follow_up_events never deleted, contact-close via DB trigger + immutable lead_events — why: UI checks can be bypassed.
- Staff names cleaned by profiles trigger; legal_name never shown — why: one rule everywhere.
- Android V2 sends six raw yes/no answers, server scores; nearby-lead GPS never uploaded — why: one scoring rule, no staff tracking.
- Project = inventory requirement labels; site visits/bookings only from saved report signals — why: no invented facts.
- Staging E2E (tests/staging) is opt-in and refuses the live project ref — why: preview and live share one DB.
- Read src/lib/AGENTS.md for scoped rules. HQ grants stay read-only; resolveWorkCaller preserves agent work, never PIN impersonation — why: no oversight escalation.
- Copilot drafts locally; PIN attempts use atomic account/surface guards — why: no hidden AI cost or shared-IP lockout.
- Dense CRM data views use compact cards below `md` and full tables at `md+`; lower-frequency wide tables scroll only inside `.table-scroll` — why: phone usability without weakening desktop comparison views.
- Winstone OS inbound events only via POST /api/public/os/events (HMAC + idempotency in server-only os_event_receipts); mapping never invents entities — why: one verified, replay-safe bridge.
- Lead neglect: zero-work leads get 2 business-day notices (recall on the 3rd) then recall to the pool via `lead-neglect.server.ts`; recalls are append-only disputes, DB blocks re-assigning to the same agent and call-start refuses them — why: leads must not rot and the rule can't be bypassed from the UI.
- UI language uses src/lib/i18n.ts (useLang/useT, localStorage, Bengali default); new UI strings add { bn, en } pairs there or inline — why: one switch for both languages.
- Pin @lovable.dev/vite-tanstack-config to 2.25.2 — why: 2.26.0 emits createRequire(import.meta.url) that crashes every page on the live Worker.
- Bookings start `approval_status='pending'`; only HQ/IT approval (server-checked authority, decision final via trigger) queues the signed OS relay event — why: HQ gatekeeps what reaches Winstone OS.
- Knowledge Hub (winstonebd.com) data enters the CRM only as public pages (website_pages), verbatim official RSS news (market_news origin='official') and signed `site_visit.requested` events on /api/public/os/events into server-only website_visit_requests; a request becomes a site_visit only when the agent/HQ confirms it — why: no invented facts, one verified bridge.
- Vite pre-bundles the TanStack router-core/seroval/h3-v2 deps in vite.config optimizeDeps.include — why: late discovery re-optimized on every cold start and broke open tabs (stale chunks / invalid server-fn IDs).
- Module recovery: router-caught import failures dispatch the shared recovery event; recovery coalesces failures and times out probes; regression-checked by bun run test:restart (sandbox-only) — why: no reload loops or blank tabs after restarts.
- Live tests needing a signed-in staff user use tests/fixtures/staff-session.ts (reuses an existing unexpired session, never creates users or prints tokens) — why: preview and live share one database.
- Board live refresh coalesces realtime changes into one snapshot reload per 8s and hidden tabs only mark it stale — why: per-change full-floor reloads in every tab were the top database load.
- Call UI reuses scoped notes/history and reporting; SIM controls use Android Telecom InCallService with explicit dialer-role consent, never a browser bridge — why: real controls, unchanged CRM gates.
- Desk uses a non-scrolling section grid; mobile navigation opens from below — why: avoid sideways navigation.
- Social moderation: CRM logs work only (append-only social_activity_logs) and makes unassigned leads via intakeLead — why: no Meta API; LeadHub assigns.
- Wrappers/portals inherit src/styles.css tokens; Buttons separate actions from accents; headers stack phone actions, dialogs reserve close space — why: one palette, phone-safe layouts.
- WhatsApp reads/summary use Dhaka-filtered bounded feed; CSV exports displayed totals safely — why: scoped, matching exports without formulas.
- Fonts use public/fonts WOFF2 + CSS @font-face, never Google CSS — why: avoid render-blocking requests.
- Private AI/bill reads authenticate; support inbox lists only the agent's own assigned conversations (other support reads follow own/unassigned work) and agent escalation requires ownership; project writes reject read-only HQ; scored time needs phone sync — why: requests cannot bypass access or fabricate evidence.

- HQ summaries share one filtered command-center result; count current follow-up work and saved booking signals — why: independent status/recording guesses contradict totals.
- Winstone AI copilot is read-only and IT Console (full PIN) only; it never assigns leads — why: LeadHub Nexus is the one assignment path with quota/Friday/audit rules.
- Release counts as deployed only when scripts/check-live-release.ts (or IT Console Deployment status) sees /manual version, $35.29 and 50-lead markers live — why: publish requests are not proof.
- The operations manual's only source is docs/CRM_OPERATIONS_MANUAL.md (parsed by src/lib/manual-source.ts for /manual); rebuild the PDF with `npm run manual:pdf`, and `manual:check` (prebuild + CI) fails on hash/version drift — why: page and PDF can never disagree.
- Android recordings fall back to the phone's own call-recorder file (PhoneRecordingPickupWorker, recorder_source=phone_recorder) through the same idempotent upload queue; no match = no upload — why: Android 10+ blocks app call-audio capture.
- Recorder (/recorder) reads agent-own call_recordings plus server-only recorder_insights (voice notes, AI takeaways/action items) via recorder.functions.ts; AI uses the shared ai-model helper and never invents facts — why: one scoped history for calls and notes.
- android/whisper is GPL-3.0 code copied from NotelyVoice (owner decision 2026-10-24); any APK linking it must ship with its full source offered, and the module stays unlinked from :app until minSdk 26, model delivery and 16 kHz PCM conversion are decided — why: license obligation and app-size impact.
- Browser-generated files are delivered through src/lib/download.ts (downloadBlob/deliverFile): build the blob first, then the click saves it, and object URLs are revoked after a delay — why: mobile browsers drop downloads started after a long await.
- Call/audio reconciliation uses call-reconciliation.ts and the same Android call UID through lifecycle/upload/report; durable queued originals are deleted only after matching server checksum/upload acknowledgement — why: filenames, report sync and audio availability are different evidence.
- Quantity assignment uses read-only candidate previews and server revalidation before the existing LeadHub write/audit path; overdue-evidence.ts gates follow-up fault counts on confirmed responsibility — why: no silent substitutions or blame from unresolved evidence.
- Messenger POST validates bounded raw-byte signatures with handler-only App Secret; durable storage (0123), AES-256-GCM body encryption (0124, MESSENGER_MESSAGE_KEY) and retention cleanup (0125: bodies 90d, events/receipts 180d, cron route /api/public/jobs/messenger-retention) are applied. Ingestion switch set by owner order 2026-10-25; POST still refuses without META_APP_SECRET. GET handshake answers only an exact META_WEBHOOK_VERIFY_TOKEN match (403 otherwise, 503 unconfigured); getMessengerService stays fail-closed — why: a valid signature cannot imply consent or successful message receipt.
- Durable receipt (per-event atomic key + content hash), storage and the staff-confirmed reviewed-lead path are written but stay switched off until the reviewed migration is applied and Meta approvals are verified; reviewed leads enter through canonical intake unassigned — why: code readiness must never be reported as a working integration, and LeadHub stays the only assignment path.
- /inbox mounts Support Desk and shared Messenger separately by selected tab; demo lead review stays disabled until verified stored-message ownership and canonical intake are implemented — why: queues retain their access boundaries and samples cannot become customer records.
- Credential file redaction runs only in browser memory and downloads only sanitized text; never upload originals, display matches or persist raw file contents — why: sensitive documents must not enter CRM telemetry or storage.
- Combined Messenger/Windsor progress uses public preparation state only, never secret inventory or provider health claims; Android phone sync stays independent of Meta — why: preparation and configured secrets do not prove consent or delivery.
- Meta diagnostics and credential replacement need full IT PIN, bounded GETs and handler-only env access; statuses are allowlisted, storage checks expose presence only, and App Review/messaging grants or revocation are never inferred — why: read access cannot authorize activation, and secret replacement is not revocation or deployment evidence.
- Lead provenance displays saved source only; legacy Messenger arrival and connection verification remain unknown, never inferred from created_at or is_verified — why: lead creation/quality are not signed message receipt evidence.
- Windsor reporting remains fail-closed without a reviewed official API contract; manual configuration-presence inspection uses the existing full IT PIN verifier and handler-only env access, never DB/provider calls — why: secret presence does not prove account scope or authorize activation.
- The public `/integrations` checklist uses browser-safe preparation evidence only; no live probes, secret inventory or persisted health claims, and linked diagnostics retain their existing gates — why: a status page cannot establish delivery or widen access.
- The public `/walkthrough` uses browser-safe curated workflow guidance and local-only reading progress; linked workspace pages keep existing gates, and completion never executes business actions — why: onboarding must not reveal records or grant authority.
- /inbox evidence checklist (meta_verification_records, 0126) and sync enable/disable decisions (messenger_sync_decisions, 0127) are append-only IT-only audit rows; credential-like notes are rejected, and enable requires all four tracks verified plus the env switch — why: evidence never stores tokens and sync can never switch on silently. Meta Control Center inherits authority gates, never probes providers or secrets, and simulation stays in tab memory.
- AI providers: one shared helper (ai-model.server.ts) with pure rules in ai-providers.ts; HQ picks openai/gemini/meta once in app_config; meta = muse-spark-1.3 via MODEL_API_KEY, fail-closed, no cross-provider key fallback, provider error bodies never logged — why: one switch everywhere, keys never leak.
- n8n lead pipeline: POST /api/public/n8n/leads (timestamped HMAC + n8n_event_receipts idempotency) feeds only canonical intakeLead (unassigned); BANT scores are advisory via shared aiChatJson with deterministic weight validation (25/20/30/25), stored append-only in lead_bant_scores; N8N_PIPELINE_ENABLED defaults off — why: CRM/LeadHub stays the system of record, no parallel path, no auto-rejection.
