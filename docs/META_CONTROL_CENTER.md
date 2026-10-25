# Meta Integration & Webhook Control Center

## Scope
`/meta-control-center` uses the existing authority gate. It contains preparation-only Page/App status, a planned callback, permission evidence checklist, real-diagnostics limitations and a preset-only local simulator. It does not call Meta, inspect or edit secrets, read production receipts, send messages, create leads, change permissions, run SQL or deploy.

The uploaded HTML is a visual/functional reference only. Its scripts, credential-like literals, sample customer information, token inputs, provider subscription buttons, SQL and legacy Edge Function code are not copied, served or executed. Existing TanStack server routes and LeadHub remain canonical.

## Current webhook behavior
Callback: `https://crm.winstonebd.com/api/public/meta/messenger`.
Do not register this as an operational callback yet. GET challenge remains disabled. POST reads `META_APP_SECRET` only inside the server handler:
1. Require a well-formed `X-Hub-Signature-256`.
2. Stream and bound the raw body to 262144 bytes.
3. Verify HMAC-SHA256 against exact raw bytes using Web Crypto.
4. Decode strict UTF-8, parse JSON and validate bounded Page events. Supported structural types are message, delivery, read and postback; unsupported/ambiguous types are rejected. This is not authorization.
5. Always refuse valid events with 503 `MESSENGER_INGESTION_NOT_READY`; never acknowledge an unpersisted event.

Failures return safe codes only: 401 signature, 413 size, 400 body/payload, 503 configuration or ingestion readiness. Payload bodies, sender identifiers, message text, tokens and raw validation/provider errors are never logged or returned. Invalid signed payloads now receive 400 instead of the prior generic 503.

## Simulator boundary
Only fixed synthetic presets are available: new event, duplicate, conflicting reuse, invalid signature and invalid payload. IDs and timestamps are explicit zero-valued fixtures, not customer data. No free-text payload or credential inputs. SHA-256 fingerprints model duplicate/conflict handling in tab-local memory; reset/reload discards them. History is limited to ten safe result codes. No network requests, localStorage, database receipt, lead intake or subscription mutation occur. The signature preset models the gate only; production cryptographic behavior is covered by webhook tests, not claimed by the simulator.

## Activation blockers
- Authoritative Meta App Review, required permission tier, Live mode, Page consent and both App/Page messaging subscriptions must be verified. Configured secrets do not establish these.
- Separately approved additive schema and secure storage are needed for real Page/conversation/message ownership and durable receipts.
- Production idempotency must atomically key provider event identity with a payload fingerprint and persist messages in the same transaction: exact replay returns the stored result; changed payload for the same identity is rejected. There is intentionally no in-memory production substitute.
- Genuine-message staff confirmation, canonical intake/dedupe and provenance evidence are needed before a lead can be created unassigned; only LeadHub assigns.
- A separately authorized release, GET handshake, signed delivery and durable read-back are required before marking connectivity verified.

## Secrets and setup
Revoke any credentials exposed in the HTML at Meta, then replace them only through the managed secret form. Do not paste them into chat or any dashboard browser field. This implementation neither rotates nor verifies revocation. After a separately authorized operational callback is deployed, use a secure shared verify-token form and copy its value into Meta; no token is requested now.
Provide approval screenshots with App Secret, access tokens, verify tokens and personal data fully redacted. Existing full-IT-PIN diagnostics remain separate and were not invoked by this task.

## Verification
Targeted tests: `tests/meta-control-center.test.ts`, `tests/messenger-webhook.test.ts`, `tests/messenger-protocol.test.ts`, `tests/messenger-inbox.test.ts`, `tests/meta-connection-boundary.test.ts`, `tests/meta-credential-safety.test.ts`, `tests/route-role-access.test.ts`.
All payloads/signing keys in tests are synthetic. Production authenticated flows and Meta delivery remain unverified under this task's no-live-access boundary.