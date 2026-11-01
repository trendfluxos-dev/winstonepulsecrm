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
- Pin @lovable.dev/vite-tanstack-config to 2.25.2 and keep TanStack router/start on their exact pins (refresh seroval transitively) — why: 2.26.0 crashes the live Worker, and react-start 1.169+ renames `.inputValidator` to `.validator`, untyping every server function.
- Bookings start `approval_status='pending'`; only HQ/IT approval (server-checked, final via trigger) queues the signed OS relay event — why: HQ gatekeeps what reaches Winstone OS.
- Knowledge Hub (winstonebd.com) data enters only as website_pages, official RSS market_news and signed site_visit.requested events (website_visit_requests); a site_visit needs agent/HQ confirmation — why: no invented facts.
- Vite pre-bundles the TanStack router-core/seroval/h3-v2 deps in vite.config optimizeDeps.include — why: late discovery re-optimized on every cold start and broke open tabs.
- Module recovery: deploy-recovery-script.ts probes page + /assets/ before backed-off reloads (max 3, one late retry); sw.js never caches /@; /load-diagnostics is authority-only, read-only, redacted — why: no reload loops, blank tabs or leaked headers.
- Vitest loads tests/setup/block-live-database.ts (fails any backend request); live probes need RUN_LIVE_SCOPE_TESTS=1, writes only under the staging guard, signed-in tests use tests/fixtures/staff-session.ts — why: preview and live share one database.
- Board live refresh coalesces realtime changes into one snapshot reload per 8s; hidden tabs only mark it stale — why: per-change full-floor reloads were the top database load.
- Call UI reuses scoped notes/history and reporting; SIM controls use Android Telecom InCallService with dialer-role consent, never a browser bridge — why: real controls, unchanged CRM gates.
- Desk uses a non-scrolling section grid; mobile nav opens from below — why: avoid sideways navigation.
- Social moderation: CRM logs work only (append-only social_activity_logs) and makes unassigned leads via intakeLead — why: no Meta API; LeadHub assigns.
- Wrappers/portals inherit src/styles.css tokens; Buttons separate actions from accents; headers stack phone actions, dialogs reserve close space; card lift needs a `--shadow-*` token (shadow-lg/xl are flattened); a translucent card edge uses `glass-hairline` — why: one palette, phone-safe layouts.
- WhatsApp reads/summary use Dhaka-filtered bounded feed; CSV exports displayed totals safely — why: exports match what staff saw.
- Agent WhatsApp alerts: approved count-only templates to the agent's own opted-in number; dedupe row reserved before send; delivery state only from the signed webhook inbox; IT full PIN master switch — why: no customer data, double sends or assumed delivery.
- Fonts use public/fonts WOFF2 + @font-face, never Google CSS — why: avoid render-blocking requests.
- Private AI/bill reads authenticate; support inbox lists only the agent's own assigned conversations and agent escalation requires ownership; project writes reject read-only HQ; scored time needs phone sync — why: requests cannot bypass access or fabricate evidence.

- HQ audit uses performance-audit.ts over authorized rows, exact-ID dedupe, strict Dhaka ranges; recordings never score — why: auditable counts without blaming audio gaps.
- Winstone AI copilot is read-only and IT Console (full PIN) only; it never assigns leads — why: LeadHub Nexus is the one assignment path.
- Release counts as deployed only when scripts/check-live-release.ts sees /manual version, $35.29 and 50-lead markers live — why: publish requests are not proof.
- The operations manual's only source is docs/CRM_OPERATIONS_MANUAL.md (parsed by src/lib/manual-source.ts for /manual); rebuild the PDF with npm run manual:pdf; manual:check fails on hash/version drift — why: page and PDF can never disagree.
- Quantity assignment uses read-only candidate previews and server revalidation before the existing LeadHub write/audit path; overdue-evidence.ts gates follow-up fault counts on confirmed responsibility — why: no silent substitutions or blame from unresolved evidence.
- Durable Meta receipt, storage and staff-confirmed reviewed-lead path stay off until the reviewed migration is applied and Meta approvals verified; reviewed leads enter canonical intake unassigned — why: code readiness is not a working integration.
- /inbox mounts Support Desk and shared Messenger separately by selected tab; demo lead review stays disabled until verified stored-message ownership and canonical intake are implemented — why: queues retain their access boundaries and samples cannot become customer records.
- Credential file redaction runs only in browser memory and downloads only sanitized text; never upload originals, display matches or persist raw file contents — why: sensitive documents must not enter CRM telemetry or storage.
- Messenger/Windsor: progress uses public preparation state only; Windsor stays fail-closed without a reviewed API contract (config presence via full IT PIN, handler-only env); Android sync is independent of Meta — why: configured secrets prove neither consent nor delivery.
- Meta diagnostics/credential replacement need full IT PIN, bounded GETs, handler-only env; presence-only checks, never inferred grants — why: read access is not activation.
- Lead provenance shows saved source only; Messenger arrival/verification stays unknown, never inferred from created_at or is_verified — why: not signed receipt evidence.
- The public `/integrations` checklist uses browser-safe preparation evidence only; no live probes, secret inventory or persisted health claims, and linked diagnostics retain their existing gates — why: a status page cannot establish delivery or widen access.
- `/walkthrough` is public, curated and local-progress only; linked pages keep gates — why: reading grants no authority or business actions.
- n8n leads: POST /api/public/n8n/leads (timestamped HMAC + n8n_event_receipts) feeds only canonical intakeLead (unassigned); BANT via aiChatJson, weights 25/20/30/25, append-only lead_bant_scores; N8N_PIPELINE_ENABLED off by default — why: CRM/LeadHub is the system of record.
- Automated Daily Lead Report uses the managed cron-authenticated callback and the shared sync helper with verified sheet backups, ID-matched updates and preserved HQ cells — why: scheduling must not erase existing sheet history or bypass caller authentication.
- Inventory Sheets snapshots use server-only system_settings; staff read, IT links, cron refresh; never write units/bookings — why: external prices cannot replace CRM facts.
- Allocation uses Dhaka receipts (HQ/LeadHub roster, Desk self); cron failures save safe reason/stage in system_alerts for HQ/IT — why: no false totals or private errors.
- AppShell overlays/dialogs/gates are React.lazy behind Suspense — why: small phone startup bundle.
- Agent snapshots use crm-agent-leads.server.ts indexed ownership union, stable updated_at/id paging, leadOwner precedence and fail on partial reads — why: no full scans, transfers or truncated totals.
- Command Agent work reviews reuse its existing OpenAI Responses path with aggregate-only sampled evidence and empty action allowlists; current canonical ownership gates agent facts — why: no customer payloads, fabricated totals or automatic CRM changes.
- Callback/manual call logging never assigns leads; new numbers enter canonical intake unassigned and require LeadHub ownership before reporting — why: calls cannot bypass routing or take another agent's lead.
- Reads use page-all.ts (parallel 1,000-row pages, id-dedupe, fail on errors); homepage uses WebP CDN/shared fonts — why: avoid serial reads/downloads.
- Desk/Analytics/HQ KPIs use kpi-contract.ts; agent-kpi-board.ts groups authorized rows, never phone-sync metrics — why: one definition.
- Rejections use shared defaults; mobile UI tests mock all writes — why: no invented facts or live test data.
- HQ forecasts never allocate; IT GitHub cannot prove sync; version choices grant no access; call-sandbox is local — why: facts are not authority.
- Extra Google tags use RootShell head; keep original — why: router dedupes.
- HQ Claude briefing: on-demand, HQ/IT-gated, aggregate-only, native /v1/messages streamed server-side — why: no customer data or background AI cost.
- GitHub access (hourly) and Firebase grpc-js advisory (daily) watches use managed cron auth, diff against system_settings and write system_alerts; failed checks never mean revocation — why: no false alarms.
- Lead `is_verified` only via ingest/outcome + `lead-verification.ts`: own completed call_recordings row (same call_uid/agent/lead) with `hasProvenTalkTime` (`android_sim` needs `talk_time_source='call_log'`); device `connected` is a claim. Late call-log entries reconcile the unique same-agent live row via `call-log-reconcile.server.ts` (`call_log_id` once, pending reports only), never merge ambiguous calls — why: app 2.21 counted ringing as talk.
- Phone call history entries use `lead-events-once.server.ts` (sync_events key `lead_event:<id>:<kind>`) — why: retries never duplicate history.
- Android sync failures: app `SyncFailureLog` → POST /api/public/agent/sync-failures → sync_events `android_sync_failure` (per device+report id, technical fields only) → authority-only read-only `/sync-failures` — why: IT sees phone failures without customer data.
