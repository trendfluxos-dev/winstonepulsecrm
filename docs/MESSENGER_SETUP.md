# Messenger continuation — disconnected, code-only

## Verified repository state

- `/messenger` and Desk Messenger share `src/components/crm/MessengerInbox.tsx`: Bengali-first, clearly labelled samples, scoped search/status filtering and phone list → thread → back navigation. No demo row is stored.
- `src/lib/messenger.functions.ts` uses existing `resolveCaller`; no new roles/auth/policies. Agents without HQ scope see own samples; authority sees all; read-only HQ cannot reply/assign. Existing agent HQ grants resolve to read-only authority here, so agent own-work behavior for those accounts is **not yet implemented**. No authorization widening was done.
- `src/lib/messenger.server.ts` always selects the disabled adapter. GET handshake remains 503 `FACEBOOK_NOT_CONNECTED`. POST validates a bounded (262144-byte) raw body against `X-Hub-Signature-256` using handler-only `META_APP_SECRET`, then validates strict UTF-8 and bounded Page message/delivery/read/postback structure; absent configuration returns 503, invalid signatures 401, oversized bodies 413, invalid signed payloads 400, valid signed payloads 503 `MESSENGER_INGESTION_NOT_READY`. No message is acknowledged, stored or sent. Human HTML navigation without `hub.*` redirects to `/messenger`.
- `/meta-control-center` adds authority-gated preparation, permission evidence, diagnostics limitations and fixed synthetic tests. No live probes or credential inputs. Its in-memory simulator is not durable production idempotency; see `docs/META_CONTROL_CENTER.md` for activation blockers.
- `/messenger-setup` and `/inbox` show preparation status, not live verification evidence. Last verification is not checked (no invented timestamp); reasons identify blockers, not fabricated provider failures. Persisted attempt history needs separately reviewed storage.
- `src/lib/messenger-protocol.server.ts` signature helper is wired only to POST refusal validation; challenge and reply preflight remain disconnected. No provider calls or storage writes occur.
- `/inbox` Support Desk and social moderation stay separate and unchanged. The existing no-Meta-API social rule remains in force; full scope authorization does not override this turn's prohibition on connection/API calls.
- `.lovable/plan.md` is historical proposal, not deployment evidence. `docs/proposals/messenger-inbox-migration.UNAPPLIED.sql` is unchanged outside migrations. Its append-only triggers remain TODO; it is **not ready to apply**.
- `.lovable/project.json` contains template/revision metadata only; it establishes no Meta setup. Hosted Meta settings, app existence, Business verification, approved permissions, Page consent and token status are **unverified**. Secrets and browser credentials were not inspected.

## Still absent from this foundation

Persistent threads/messages/unread state; ownership rechecks against stored threads; LeadHub-PIN assignment/unassignment; active-roster checks; canonical lead linking/phone dedupe; durable receipt/outbox idempotency; audit/append-only enforcement; rate limiting/retries; token encryption/expiry/revocation; real delivery/read receipts; privacy/deletion workflow. Search and filtering are demo-only. Offline preflight is not a replacement for server authorization.

## App verification checklist — owner checks, not inferred status

Every item below is **unverified** until the owner checks it in Meta; an uploaded credential document, saved secret or demo screen is not proof.

1. Open Meta for Developers → My Apps under the authorized owner account. Check for the intended existing app before creating anything. If none is found, stop and agree the App creation step separately; this project does not create one.
2. In the selected app, confirm its identity, owning Business portfolio, administrator access and intended Facebook Page; check available Messenger and Webhooks use cases/products. Do not paste credentials in chat or send screenshots showing secret values.
3. Review App mode, app-role/test access, permission access levels, review decisions and any required business verification. Development/test access does not prove availability to all CRM agents or real customers.
4. Confirm the owner controls the intended Page and has permission to authorize it. For Lead Ads, separately confirm lead-access rights in the Business portfolio/Leads Access Manager for the people or integration involved; Page control alone does not establish lead access.
5. Review privacy policy, data deletion instructions/callback design, retention and consent. Do not register a placeholder privacy URL as a completed policy.
6. Check the app's Webhooks Page subscriptions and the Page's app subscription separately. An app subscription is not proof that the Page is subscribed, and a subscribed field is not proof the CRM receives or stores it.
7. Record only non-sensitive verification outcomes with the owner. This repository intentionally has no readiness flag capable of switching on Meta calls. Configuration presence, if added later, must be server-only, authorized, boolean-only and distinct from verified permissions/connection/delivery.

## Credential and permission matrix (not a request for values)

| Capability | Configuration / credential | Permission or owner gate | Status / restriction |
|---|---|---|---|
| Identify app | `META_APP_ID` | Owner confirms existing app and administrator access | Unverified; not an access token and not evidence of approval |
| Verify signed webhook body | `META_APP_SECRET` | App owner obtains it from App settings; server-only | Offline HMAC tested; handler remains disabled |
| Webhook verification handshake | `META_WEBHOOK_VERIFY_TOKEN` | Shared value owner enters in Meta and authorized project secrets UI | Not requested here; only configure after authorized endpoint is ready; current endpoint returns 503 |
| Page selection / metadata | `META_PAGE_ID`, appropriately scoped Page token | `pages_show_list` for login Page selection; `pages_read_engagement` only for required reads | Page/app association unverified; no Page lookup performed |
| Messenger reads/replies | Server-only `META_PAGE_ACCESS_TOKEN` | `pages_messaging`, Page authorization, applicable Advanced Access/App Review; standard 24-hour policy | No outbound messaging or real inbox storage wired |
| Page webhook subscription | Page token plus app credentials for signature validation | `pages_manage_metadata`; app Webhooks **Page** object and Page app subscription | Fields as needed: `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`; no subscriptions made |
| Lead Ads notification | Reviewed Page authorization/token strategy | `pages_manage_metadata` for Page subscription; Page Webhooks `leadgen` field | No Lead Ads endpoint/subscription/import implemented; notification alone is not lead details |
| Retrieve Lead Ads form responses | Reviewed scoped Page/user/system-user token appropriate to approved flow | `leads_retrieval`, authorized Page/form and Business lead access; additional `pages_read_engagement`, `pages_show_list` or `ads_management` only when the chosen flow/endpoints require them | Owner verifies current Meta requirements and review/access; no live fetch or lead import |
| Business asset discovery | Approved token appropriate to selected flow | `business_management` only when necessary; do not request broad access by default | Not required merely to show disconnected demo |
| Encrypted durable token storage | App-owned token-encryption key and reviewed storage | Separate architecture, migration and owner authorization | No key generated, no token copied, no storage/schema change |

Permission names are preparation targets, not a claim that Meta has granted them. Messenger, Webhooks and Lead Ads are separate gates; Meta Ads account connection does not automatically authorize any of them. Verify the current required permissions for the exact app use case and token flow in Meta's dashboard/documentation before requesting access. Never submit a Facebook password to project secrets. Unknown token-like material in uploads remains sensitive and is not copied or reused.

### Lead Ads acceptance gates before any later import

Verify app/Page/form permission and lead access in isolated testing; validate raw signed `leadgen` events and bounded payloads; store replay-safe receipts atomically; retrieve only authorized form data; require documented consent and field mapping; normalize/dedupe phone through canonical intake; never invent missing contact fields or entities. New leads must land unassigned through `intakeLead` and use the existing LeadHub assignment/audit/quota rules. No import, persistence or outbound call is added in this pass.

### Readiness reporting decision

The existing guide is the readiness surface for this pass; the Messenger UI and its “Facebook not connected yet” notice are preserved. No new public diagnostic endpoint or runtime secret reader is introduced: boolean presence cannot establish app existence, token validity, Page consent or permission approval, and a safe owner-only diagnostics surface would require separate review. Owner saves credentials only in authorized Project Settings → Secrets after setup verification, never chat. The attempted secure form in the preceding task was unavailable and did not run; no credential was saved by that attempt. No secret request or settings read/write is performed in this pass.

### Owner-authorized encrypted Page secret storage (follow-up)

Use the managed Lovable Cloud encrypted secret store for `META_PAGE_ACCESS_TOKEN` and `META_PAGE_ID`, collected only through the secure secrets form or authorized Project Settings → Secrets. Values never belong in source files, `.env` commits, browser storage, downloadable documents or logs. This single-Page configuration does not require a new database table or an additional app-managed encryption key. A future multi-Page token database would still require separate encryption/schema review. Owner saved both secret names through the secure form in this follow-up; the tool confirmed they are set, and no value was read or exposed. Saving configuration does not connect a Page, verify the token or establish App Review. No runtime credential reader is added until a separately authorized server-only integration needs one; the disabled adapter remains unchanged.

## Owner / Page administrator steps (do not perform during this pass)

1. Confirm whether a Meta Developer App already exists. If not, create an app using Meta's current Business/Messenger use case, associate the appropriate Business portfolio and add/configure Messenger for the intended Facebook Page. Complete business verification where Meta requires it; do not assume every permission has identical requirements.
2. Confirm Page control/admin access and authorize that specific Page through the approved Page-token flow. No account password belongs in the CRM. Review required access: `pages_messaging` for messages, `pages_manage_metadata` for Page webhook subscription; `pages_show_list` if selecting Pages via login, and `pages_read_engagement` only if required for the chosen Page reads. `business_management` is conditional, not a blanket requirement. Confirm exact requirements in the app dashboard/current Meta documentation.
3. Obtain necessary Advanced Access/App Review before serving people outside app roles; prepare reviewer instructions, a working test Page, consent-flow screencast, verified business details where required and approved privacy/data-deletion URLs. Do not claim App Review or Live mode is complete until verified.
4. Approve truthful privacy notice and a deletion/retention process before using real messages. Existing zero-data-loss/audit requirements need an explicit privacy-approved retention/redaction design; no unreviewed deletion or invented compliance statement.
5. In a **separately authorized** change, owner adds server-side configuration through Project Settings → Secrets: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, plus a reviewed token-encryption key. Page access tokens must use encrypted server-only storage; never browser code/logs. Token lifetimes vary and can be revoked even if they have no scheduled expiry—do not rely on the old plan's “does not expire” claim.
6. Separately review schema proposal, explicit grants/RLS, append-only triggers, transaction/receipt/outbox uniqueness, ownership and LeadHub PIN gates. Obtain approval and a verified backup before any migration. No migration or SQL executed here.
7. Implement and test against an isolated backend/test Page first. Only after separate authorization to enable handlers, configure `https://crm.winstonebd.com/api/public/meta/messenger` with the owner's verification token. **The current URL refuses verification with 503; do not register it as working.** Subscribe to `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads` as needed; subscribe the app to the Page with approved access. Handovers are optional and require a reviewed ownership design.
8. Enforce server-owned thread access, current 24-hour standard reply window, suppression, briefing and maintenance gates. Do not enable any message tag/extended window on the historical plan's assumption; check current Meta policy and explicit app eligibility. Record accepted vs delivered vs read distinctly. Handle error 190/revocation by stopping sends, bounded rate-limit/5xx retries, and ambiguous send timeouts by reconciliation—not blind resend.
9. After separate approval, verify duplicate webhooks → one stored message; double-submit → one outbox item; assignment only through LeadHub; only current owner replies; HQ read-only; disconnect stops sends and preserves approved history. Publishing requires a separate explicit request.

## Validation boundaries

### Exposed-token replacement and confirmation

Replace only through the managed secure update form or Project Settings → Secrets, never through CRM inputs, uploads, chat or source edits. The owner saved a replacement `META_PAGE_ACCESS_TOKEN` through the secure form in this follow-up; no value was available to the assistant. `META_PAGE_ID` is a Page identifier, not a revocable access token, and was not changed. Other exposed user/system-user tokens must also be revoked at their issuing Meta authorization; they are not configured token sources in the current CRM.

1. In the issuing Meta app/business authorization, revoke the exposed token/authorization using the applicable owner controls; merely issuing a new token is not proof the previous one stopped working. Review affected app/system-user grants and issue a least-privilege replacement for the intended Page. Do not submit old tokens here to test them.
2. Save the replacement in the existing managed Page-token secret. Do not retain a backup token or fallback in app code. Current Meta diagnostics read that single configuration inside the handler on every request; the Messenger adapter still refuses ingestion/replies.
3. `/inbox` → Check secure storage requires full IT PIN, performs no provider or database calls, returns configuration presence and actual attempt time only, and cannot certify a changed value or revocation. No hashes, fragments, lengths or credential comparisons are exposed. Results are session-only, not a rotation audit record.
4. Preview receives updated secrets immediately; production replacement requires separately authorized publishing and a subsequent live check. No publication occurred in this task, so production may still hold the prior configuration. Provider revocation must not wait for publishing. After separate release authorization, check the published credential-backed flow and review Meta-side revocation evidence without exposing tokens. Until both are established, report old-token non-use/revocation as **unverified**, not complete.

The storage check never claims App/Page permissions or delivery, enables Messenger, or accepts user assertions as provider proof. No live old-token test or persistent audit storage was added.

### Manual safe Meta connection test

`/inbox` includes a full-IT-PIN-only manual test. It reads configured Page identity and Page/app subscriptions with GET requests, server-only Authorization headers, 10-second request deadlines, bounded response bodies and no redirects. No credentials, raw provider responses, IDs or token-derived data are returned or logged; failures are allowlisted codes. The test does not fetch customer conversations, subscribe an app, write data, activate handlers or send messages. Page identity/association and both `messages` subscription levels can be checked, but App Review/Live mode/Advanced Access and `pages_messaging` approval remain **unverified** without authoritative evidence. A subscription is not a successful signed delivery. Results and Dhaka check time remain only in the current UI session; no durable history is claimed.

Reference: https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/ and https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/ . No live test performed during implementation.

Unit tests use synthetic strings only, verify exact raw-body HMAC, malformed challenges, 24h boundary, privacy-safe disabled adapter (no network), scoped filtering, and gate refusals. Existing Support Desk/social/role tests run as regression checks. No live Meta, live database, browser credentials or secrets are used. Real signature ingestion/storage/delivery and authenticated phone navigation remain unverified until permitted isolated setup.