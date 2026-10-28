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
- Read src/lib/AGENTS.md and android/AGENTS.md for scoped rules. HQ grants stay read-only; resolveWorkCaller prefers verified session to PIN for own work — why: no PIN impersonation or blocked agent work.
- Copilot drafts locally; PIN attempts use atomic account/surface guards — why: no hidden AI cost or shared-IP lockout.
- Dense CRM data views use compact cards below `md` and full tables at `md+`; lower-frequency wide tables scroll only inside `.table-scroll` — why: phone usability without weakening desktop comparison views.
- Winstone OS inbound events only via POST /api/public/os/events (HMAC + idempotency in server-only os_event_receipts); mapping never invents entities — why: one verified, replay-safe bridge.
- Lead neglect: zero-work leads get 2 business-day notices (recall on the 3rd) then recall to the pool via `lead-neglect.server.ts`; recalls are append-only disputes, DB blocks re-assigning to the same agent and call-start refuses them — why: leads must not rot and the rule can't be bypassed from the UI.
- UI: i18n English default, saved choice wins, Bi headings; sign-in reuses topPerformerToday reveal/ranking, aggregates only — why: one score, no customer disclosure.
- Pin @lovable.dev/vite-tanstack-config to 2.25.2 — why: 2.26.0 emits createRequire(import.meta.url), crashing every page on the live Worker.
- Bookings start `approval_status='pending'`; only HQ/IT approval (server-checked, final via trigger) queues the signed OS relay event — why: HQ gatekeeps what reaches Winstone OS.
- Knowledge Hub (winstonebd.com) data enters the CRM only as public pages (website_pages), verbatim official RSS news (market_news origin='official') and signed `site_visit.requested` events into server-only website_visit_requests; a request becomes a site_visit only when the agent/HQ confirms it — why: no invented facts, one verified bridge.
- Vite pre-bundles the TanStack router-core/seroval/h3-v2 deps in vite.config optimizeDeps.include — why: late discovery re-optimized on every cold start and broke open tabs.
- Module recovery: router-caught import failures dispatch the shared recovery event; coalesces failures and times out probes; checked by bun run test:restart — why: no reload loops or blank tabs after restarts.
- Live tests needing a signed-in staff user use tests/fixtures/staff-session.ts (reuses an existing session, never creates users) — why: preview and live share one database.
- Board live refresh coalesces realtime changes into one snapshot reload per 8s; hidden tabs only mark it stale — why: per-change full-floor reloads were the top database load.
- Call UI reuses scoped notes/history and reporting; SIM controls use Android Telecom InCallService with dialer-role consent, never a browser bridge — why: real controls, unchanged CRM gates.
- Desk uses a non-scrolling section grid; mobile nav opens from below — why: avoid sideways navigation.
- Social moderation: CRM logs work only (append-only social_activity_logs) and makes unassigned leads via intakeLead — why: no Meta API; LeadHub assigns.
- Wrappers/portals inherit src/styles.css tokens; Buttons separate actions from accents; headers stack phone actions, dialogs reserve close space; card lift needs a `--shadow-*` token (shadow-lg/xl are flattened); a translucent card edge uses `glass-hairline` — why: one palette, phone-safe layouts.
- WhatsApp reads/summary use Dhaka-filtered bounded feed; CSV exports displayed totals safely — why: exports match what staff saw.
- Fonts use public/fonts WOFF2 + @font-face, never Google CSS — why: avoid render-blocking requests.
- Private AI/bill reads authenticate; support inbox lists only the agent's own assigned conversations and agent escalation requires ownership; project writes reject read-only HQ; scored time needs phone sync — why: requests cannot bypass access or fabricate evidence.

- HQ operational audit uses performance-audit.ts over authorized rows with exact-ID/call-identity dedupe and strict Dhaka ranges; recordings stay optional diagnostics and never score, completion uses saved work_date/current state — why: auditable work counts without blaming audio gaps or inventing historical completion.
- Winstone AI copilot is read-only and IT Console (full PIN) only; it never assigns leads — why: LeadHub Nexus is the one assignment path.
- Release counts as deployed only when scripts/check-live-release.ts sees /manual version, $35.29 and 50-lead markers live — why: publish requests are not proof.
- The operations manual's only source is docs/CRM_OPERATIONS_MANUAL.md (parsed by src/lib/manual-source.ts for /manual); rebuild the PDF with npm run manual:pdf; manual:check fails on hash/version drift — why: page and PDF can never disagree.
- Recorder (/recorder) reads agent-own call_recordings plus server-only recorder_insights (voice notes, AI takeaways) via recorder.functions.ts; AI uses the shared ai-model helper and never invents facts — why: one scoped history for calls and notes.
- Browser-generated files are delivered through src/lib/download.ts (downloadBlob/deliverFile): build the blob first, then the click saves it, and object URLs are revoked after a delay — why: mobile browsers drop downloads started after a long await.
- Call/audio reconciliation uses call-reconciliation.ts and the same Android call UID through lifecycle/upload/report; durable queued originals are deleted only after matching server checksum/upload acknowledgement — why: filenames, report sync and audio availability are different evidence.
- Quantity assignment uses read-only candidate previews and server revalidation before the existing LeadHub write/audit path; overdue-evidence.ts gates follow-up fault counts on confirmed responsibility — why: no silent substitutions or blame from unresolved evidence.
- Durable receipt (per-event atomic key + content hash), storage and the staff-confirmed reviewed-lead path are written but stay switched off until the reviewed migration is applied and Meta approvals are verified; reviewed leads enter through canonical intake unassigned — why: code readiness must never be reported as a working integration, and LeadHub stays the only assignment path.
- /inbox mounts Support Desk and shared Messenger separately by selected tab; demo lead review stays disabled until verified stored-message ownership and canonical intake are implemented — why: queues retain their access boundaries and samples cannot become customer records.
- Credential file redaction runs only in browser memory and downloads only sanitized text; never upload originals, display matches or persist raw file contents — why: sensitive documents must not enter CRM telemetry or storage.
- Combined Messenger/Windsor progress uses public preparation state only, never secret inventory or provider health claims; Android phone sync stays independent of Meta — why: preparation and configured secrets do not prove consent or delivery.
- Meta diagnostics and credential replacement need full IT PIN, bounded GETs and handler-only env access; statuses are allowlisted, storage checks expose presence only, and App Review/messaging grants or revocation are never inferred — why: read access cannot authorize activation, and secret replacement is not revocation or deployment evidence.
- Lead provenance displays saved source only; legacy Messenger arrival and connection verification remain unknown, never inferred from created_at or is_verified — why: lead creation/quality are not signed message receipt evidence.
- Windsor reporting remains fail-closed without a reviewed official API contract; manual configuration-presence inspection uses the existing full IT PIN verifier and handler-only env access, never DB/provider calls — why: secret presence does not prove account scope or authorize activation.
- The public `/integrations` checklist uses browser-safe preparation evidence only; no live probes, secret inventory or persisted health claims, and linked diagnostics retain their existing gates — why: a status page cannot establish delivery or widen access.
- `/walkthrough` is public, curated and local-progress only; linked pages keep gates — why: reading grants no authority or business actions.
- AI providers: one shared helper (ai-model.server.ts) with pure rules in ai-providers.ts; HQ picks openai/gemini/meta once in app_config; meta = muse-spark-1.3 via MODEL_API_KEY, fail-closed, no cross-provider key fallback, provider error bodies never logged — why: one switch everywhere, keys never leak.
- n8n lead pipeline: POST /api/public/n8n/leads (timestamped HMAC + n8n_event_receipts idempotency) feeds only canonical intakeLead (unassigned); BANT scores are advisory via shared aiChatJson with deterministic weight validation (25/20/30/25), stored append-only in lead_bant_scores; N8N_PIPELINE_ENABLED defaults off — why: CRM/LeadHub stays the system of record, no parallel path, no auto-rejection.
- Automated Daily Lead Report uses the managed cron-authenticated callback and the shared sync helper with verified sheet backups, ID-matched updates and preserved HQ cells — why: scheduling must not erase existing sheet history or bypass caller authentication.
- Inventory Sheets snapshots use server-only system_settings; staff read, IT links, cron refresh; never write units/bookings — why: external prices cannot replace CRM facts.
- Allocation uses Dhaka receipts (HQ/LeadHub roster, Desk self); cron failures save safe reason/stage in system_alerts for HQ/IT — why: no false totals or private errors.
- AppShell overlays/dialogs/gates are React.lazy behind Suspense — why: small phone startup bundle.
- Agent snapshots use crm-agent-leads.server.ts paged ownership union, preserving leadOwner precedence and failing on partial reads — why: no duplicate lead transfer or truncated totals.
- Command Agent work reviews reuse its existing OpenAI Responses path with aggregate-only sampled evidence and empty action allowlists; current canonical ownership gates agent facts — why: no customer payloads, fabricated totals or automatic CRM changes.
- Callback/manual call logging never assigns leads; new numbers enter canonical intake unassigned and require LeadHub ownership before reporting — why: calls cannot bypass routing or take another agent's lead.
- Lead-import sheet previews use only existing server-configured report workbooks; inventory keeps its separate read scope, and audit exports neutralise every spreadsheet cell — why: workspace credentials and trusted exports cannot widen access or execute staff-supplied formulas.
- Multi-page server reads use src/lib/page-all.ts (parallel 1,000-row pages, id-dedupe, fail on any page error); homepage device images are small WebP CDN assets and identical font files are referenced by one URL — why: sequential paging and duplicate downloads were the main load delays.
- Agent KPIs (My Desk, Analytics and HQ roster dashboard) come only from kpi-contract.ts; agent-kpi-board.ts groups authorized rows, never phone-sync metrics — why: one definition per number.
- HQ pool supply warnings use lead-pool-coverage.ts without changing allocation schedules — why: coverage forecasts are not assignment evidence.
