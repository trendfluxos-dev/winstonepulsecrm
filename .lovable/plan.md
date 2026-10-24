# Windsor.ai read-only Facebook Ads preparation

## Scope
- Add `/facebook-ads` with existing CRM styling and Bengali/English labels, a disconnected notice, bounded reporting-period controls, and clear setup blockers. No sample metrics or campaign/budget controls.
- Link from existing authority navigation; preserve agent permissions and the separate Messenger and Support inboxes.
- Add a fail-closed server boundary using the existing full IT PIN verifier without database reads. It reports only configuration presence and an empty report; it cannot contact Windsor or Meta, even when a key is set.
- The owner must revoke the previously exposed key and later enter a replacement as `WINDSOR_AI_API_KEY` through Project Settings → Secrets. This task neither reads nor changes stored secrets.

## Technical details
- Pure request validation: strict calendar dates, at most 31 inclusive days, explicit timezone, fixed reporting-field allowlist; reject unknown fields and account/endpoint injection.
- Read environment configuration only inside the server-function handler after authorization. No provider adapter until the official endpoint, schema, account scope, currency, timezone and pagination/limits are confirmed.
- Tests cover date boundaries, field validation, full-PIN-only access, disconnected results with and without configuration, and absence of network/database/storage activity.
- Document repository evidence, remaining owner setup and exact verification in `docs/WINDSOR_AI_SETUP.md` and `roadmap.md`; record the fail-closed architecture in `AGENTS.md`.

## Safeguards and verification
No deployment, SQL/migrations, production data queries/writes, auth/role/RLS/settings/secret changes, browser credentials or live API calls. Run isolated relevant tests; use automatic build/typecheck results. Signed-in production reporting is intentionally unverified; provider integration remains blocked pending contract confirmation and separate approval.

---

# Prior Facebook Messenger Shared Inbox — Implementation Plan (historical reference)

Nothing has been changed. No code, database, auth, secrets or Meta settings were touched, and no migration was run.

## 1. Evidence from the current codebase

| Area | What exists today | Evidence |
|---|---|---|
| Roles | DB enum `app_role` = `admin`, `team_leader`, `agent` only. There are no `SUPER_ADMIN`/`AUTHORITY`/`MANAGER` roles in the DB. "authority" is a server *scope* (admin or Executive HQ grant), and HQ is read-only. | `src/integrations/supabase/types.ts:6605`; `src/lib/access.server.ts:59-124` |
| Workspace grants | `workspace_role_grants` (e.g. `executive_hq`); LeadHub and IT use PIN scopes through `adminTokenScope` | `access.server.ts:59, 87, 164-165` |
| Work caller | `resolveWorkCaller` keeps agent work and never impersonates through a PIN | `access.server.ts:180` |
| Agent accounts | `profiles` (role, is_active, approval_status); `eligibleRoster` = active + approved agents | `src/lib/assignment-preview.ts`, `src/lib/lead-pool.server.ts` |
| Lead intake | `intakeLead` creates unassigned leads; only LeadHub assigns them (50/day cap, Friday block) | `src/lib/lead-intake.server.ts:31`; project rules |
| Phone dedupe | `lead_phone_keys`, `normalize_bd_phone`, `lead_phone_status` | DB functions list |
| Assignment history | `lead_assignments`, `lead_events`, `audit_logs` (append-only) | tables list |
| Existing inboxes | `/inbox` = Support Desk inbox (agents see only their own assigned conversations); `/support`, `/support-admin` | `src/routes/inbox.tsx`; `tests/support-inbox-agent-scope.test.ts` |
| Social | `/social-pages`, `social_pages`, `social_reply_templates`, append-only `social_activity_logs`. Rule: "no Meta API; LeadHub assigns." | project knowledge; `tests/social-moderation.test.ts` |
| Webhook patterns | `/api/public/os/events` (HMAC + idempotency via `os_event_receipts`); `/api/public/whatsapp/webhook` | `src/routes/api/public/os/events.ts`, `whatsapp/webhook.ts` |
| Suppression | `do_not_contact` (STOP/বন্ধ → global suppression) | tables list; core memory |

Conflict to resolve first: the project rule says social moderation uses **no Meta API**. This plan replaces that rule for Messenger only, and only after the owner approves in writing. Messenger leads still enter through `intakeLead`, and only LeadHub assigns them.

## 2. Role mapping (your names → the system)

```text
SUPER_ADMIN -> IT Console (admin role + full PIN): connect/disconnect Page, rotate token, settings
AUTHORITY   -> Executive HQ: read-only view of every conversation and the audit log; no replies
MANAGER     -> LeadHub Nexus (PIN): assign, unassign and reassign conversations; see the unassigned queue
AGENT       -> agent role: sees and replies only to conversations assigned to them
```
No new DB role is added. These map to the existing scopes.

## 3. Phased architecture

### Phase 0: Manual Meta setup (owner/Page admin; cannot be done in code)
- Meta Business portfolio verified; Meta App (Business type) with the Messenger product.
- Page admin consent through Facebook Login for Business.
- Permissions: `pages_messaging`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`, plus `business_management` if needed. Each needs App Review with a screencast and a privacy policy URL (https://crm.winstonebd.com/privacy). Live mode is needed before real customers are served.
- Webhook subscription fields: `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`, `messaging_handovers` (optional).
- Secrets to add in Project Settings → Secrets: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`. The Page token is stored server-side (see Phase 1). Nothing goes in client code.

### Phase 1: Data model (migration written, run only after approval)
New tables. All are server-only with RLS on: no client policies, and access goes through server functions.
- `meta_page_connections`: page_id, page_name, encrypted page token (pgsodium/vault or AES using a secret key), scopes, connected_by, connected_at, expires_at/last_validated_at, status (active/expired/revoked).
- `messenger_threads`: page_id, psid (page-scoped user id), lead_id (nullable), assigned_agent_id, status (open/pending/closed), unread_count, last_inbound_at (drives the 24h window), last_message_at. Unique (page_id, psid).
- `messenger_messages`: thread_id, mid (Meta message id, unique), direction, body, attachments metadata, sent_by, delivery/read status, error_code. Append-only through a trigger.
- `messenger_webhook_receipts`: event hash/mid, received_at, processed state. This gives idempotency, like `os_event_receipts`.
- `messenger_thread_events`: append-only assign/unassign/status/link history. Reuse `audit_logs` for privileged actions.
- `messenger_outbox`: queued replies with attempt count, next_retry_at and last error.
No existing table is altered. Zero data loss.

### Phase 2: Webhook ingestion
- `src/routes/api/public/meta/messenger.ts`
  - GET: verify `hub.mode=subscribe` and `hub.verify_token`, then echo the challenge.
  - POST: read the raw body and verify `X-Hub-Signature-256` (HMAC-SHA256 with the app secret, timing-safe), then validate with Zod. Store a receipt keyed on mid/event hash. Upsert the thread, insert the message, bump unread and `last_inbound_at`. Return 200 fast. Heavy work (profile fetch, lead link) goes to a queue sweep.
- Opt-out words (STOP/বন্ধ) feed into `do_not_contact`.
- Web Crypto HMAC runs on the Worker runtime.

### Phase 3: Lead linking and deduplication
- A thread starts unlinked. If the customer shares a phone number in chat, normalize it with `normalize_bd_phone`. If it matches an existing lead, propose a link for an agent or LeadHub to confirm. Otherwise LeadHub can create the lead with `intakeLead(source="facebook_messenger")`, which lands unassigned.
- Never auto-merge and never invent a phone number. PSID is not a phone key.

### Phase 4: Assignment and ownership
- New threads go to the LeadHub "Messenger unassigned" queue.
- LeadHub assigns, unassigns or reassigns with a reason. This is logged and only goes to agents in `eligibleRoster`. If the thread is linked to a lead, assignment follows the lead's owner by default, shown in a preview before confirming. There is no bulk assignment without review.
- A thread does not count toward the 50 leads/day cap unless a lead is created. Friday rules apply to lead creation and assignment.

### Phase 5: Agent inbox UI
- New route `/messenger`, separate from the English Support Desk `/inbox`, with a Bengali-first UI using `useT`.
- Phone: compact list, then the thread view. Desktop: list and thread side by side.
- Features: unread badge, status filter, 24h-window indicator, reply box, templates from `social_reply_templates`, "link lead", and a lead dossier side panel.
- The 9:05 briefing ack and the maintenance lock are enforced server-side on reply, like every other agent mutation.
- HQ sees a read-only version; the reply box is hidden and the server refuses replies.

### Phase 6: Sending, the 24-hour policy and reliability
- Server function `sendMessengerReply`: checks caller ownership → checks the thread's 24h window → checks do-not-contact → writes to the outbox → POSTs `/{page-id}/messages` (Send API, `messaging_type=RESPONSE`).
- Outside 24h: block a free reply. Allow only an approved Message Tag (e.g. `HUMAN_AGENT`, a 7-day window, which needs extra App Review approval), or show "customer must message first".
- Idempotency: a client request UUID is stored in the outbox, so a double click sends only once.
- Retries: exponential backoff for 5xx and rate-limit errors (codes 4/17/32/613). Error 190 (bad token) or 10/200 (permission) marks the connection expired and stops retries. Error 551 means the user is unavailable.
- Rate limits: per-page throttle and a small sweep batch size.

### Phase 7: Token lifecycle and disconnect
- Get a long-lived Page token (system-user token preferred; it does not expire). Validate it daily through `debug_token` via a cron at `/api/public/meta/cron`, protected by a secret header.
- On expiry or revoke: status=expired, IT Console banner, inbox becomes read-only, replies queue with a clear reason.
- Disconnect: unsubscribe the app and wipe the token. Threads and messages are kept (zero data loss).
- Data deletion callback route, as Meta requires. It is append-only safe: it redacts message bodies, keeps an audit stub, and needs owner sign-off.

### Phase 8: Privacy and security
- The token is never sent to the browser or written to logs.
- Agents can read only threads assigned to them. Their own access is checked server-side, and RLS stays closed.
- PII (names, profile pics) is fetched only when needed. Attachment URLs are proxied or expire.
- Every assign, link, send, disconnect and token action is audited.

## 4. Code vs manual

| Code (we can build) | Manual (owner / Page admin / Meta) |
|---|---|
| Tables, RLS, server functions, webhook route, signature check, outbox, retries, UI, tests, token encryption, cron | Business verification, Meta App creation, App Review for each permission, Page admin consent, webhook URL + verify token entry in the Meta dashboard, adding the secrets, switching to Live mode, the HUMAN_AGENT tag approval, the privacy policy and data deletion URLs |

## 5. Test plan
- Webhook: valid, invalid and missing signature; GET verify; duplicate mid delivered twice → one message stored; malformed payload → 400.
- Access: an agent cannot read or reply to another agent's thread; HQ reply is refused; LeadHub assign without a PIN is refused; ineligible or inactive agents are rejected.
- Policy: reply at 23h59m is allowed; at 24h01m it is blocked unless a tag is approved; a do-not-contact customer is blocked; STOP creates suppression.
- Reliability: a double-submit request UUID sends once; rate-limit errors retry with backoff; error 190 marks the token expired and stops sending.
- Lead linking: a phone in chat is canonicalized; a match is proposed, not merged; a new lead is created unassigned.
- Briefing and maintenance lock gate replies.
- Regression: the Support Desk `/inbox` scope tests and the social-moderation tests still pass.
- Staging only for live Meta: use a test Page plus Meta test users. Never run against the live project ref.

## 6. Risks
- App Review can take weeks, and rejection blocks go-live.
- The "no Meta API" rule changes, which needs explicit owner approval.
- The 24h policy limits follow-ups. Agents must still follow up by phone.
- Preview and live share one database, so webhook testing needs a separate test Page and careful flags.
- A token leak would expose the Page, so the token is encrypted and server-only.
- Message volume could add database load. Reuse the realtime coalescing pattern (one refresh per 8s).

## 7. Prerequisites
1. Owner approves replacing the "no Meta API" rule for Messenger.
2. Meta Business verified; Page admin available for consent.
3. Privacy policy and data deletion pages approved.
4. Secrets added by the owner.
5. A test Page for staging.

## 8. Acceptance criteria
- A message sent to the Page appears in the CRM within 10s, stored exactly once.
- New threads appear only in the LeadHub unassigned queue; after assignment, only that agent sees and can reply.
- A reply reaches Messenger; a failure shows a clear reason and retries safely; nothing is shown as delivered without Meta confirmation.
- Replies outside 24h are blocked with an explanation.
- Every assign, link, send and disconnect is in the audit history.
- Disconnect or expiry stops sending but keeps all history.
- All new tests pass; existing tests still pass; no existing data is changed.
