# Winstone AI Lead Pipeline — Implementation Plan (PLAN ONLY)

n8n automation → authenticated webhook → canonical CRM intake → AI BANT scoring → LeadHub Nexus routing. Winstone CRM / LeadHub Nexus stays the single system of record; n8n is only a transport/automation engine. No code changed in this plan.

## Architecture inventory: reuse vs missing

| Area | Status | Evidence |
|---|---|---|
| Lead intake + phone dedupe | REUSE | `intakeLead`, `normalizeLeadPhone`, `resolveLeadIdByPhone` — `src/lib/lead-intake.server.ts`; unassigned landing, audit events built in |
| BD phone normalization | REUSE | `normalizeBangladeshPhone` (canonical digits-only `880…`) — `src/lib/lead-phone.ts` |
| LeadHub assignment + quota | REUSE (manual) | 50/day quota, Friday block, reviewed preview-then-assign — `src/lib/lead-quota.ts`, `src/lib/business-day.ts`, `src/lib/coordinator-deck.functions.ts` |
| Consent / DNC | PARTIAL | `consent_records`, `do_not_contact`, `assertContactable`, `saveConsent` — `src/lib/comms-guard.server.ts` (migration 0015). Missing: pipeline opt-in gate, automatic WhatsApp STOP ingestion |
| Signed webhook + idempotency | REUSE pattern | HMAC raw-body verify + durable receipts — `src/lib/messenger-webhook.server.ts`, `messenger_webhook_receipts`; OS events HMAC+bearer — `src/lib/os-bridge.ts` |
| Rate limiting | REUSE | `createRateLimiter` (120/min, instance-local) — `src/lib/rate-limit.ts` |
| AI calls | REUSE | `aiChatJson<T>` multi-provider (openai/gemini/meta/vertex) — `src/lib/ai-model.server.ts` |
| Lead scoring | CONFLICT | Existing V2 is deterministic 6-question/90-pt (`src/lib/lead-evaluation.ts`), not BANT. BANT is a new, separate artifact — never rescore V2 |
| Append-only history | REUSE | `lead_events` immutable triggers, `logLeadEvent` — `src/lib/lead-events.server.ts` |
| Retention | REUSE pattern | Messenger retention cron (90/180d) — `src/routes/api/public/jobs/messenger-retention.ts` |
| n8n | MISSING | No n8n references anywhere in the repo |

## Phases

### Phase 1 — Consent & privacy foundation
- New table `lead_consent_events` (append-only): lead/phone, purpose (`marketing`, `follow_up`, `recording`), granted/withdrawn, source, actor, timestamp. Reuse `do_not_contact` for suppression; withdrawal writes `addDoNotContact(phone, "all")` plus a consent event.
- Pipeline gate: no automated outreach to a lead without an affirmative purpose-specific opt-in; `assertContactable` already blocks sends.
- Retention: extend the messenger-retention cron pattern to pipeline artifacts (BANT payloads 90d, consent events kept permanently as legal record).
- Access: RLS server-only; staff reads via existing `resolveCaller` gates.

### Phase 2 — n8n inbound webhook
- New route `POST /api/public/n8n/leads` following the OS-events pattern: raw-body HMAC (`N8N_WEBHOOK_SECRET`, timestamped, 300s window) OR bearer, 64KB cap, `createRateLimiter` 120/min, Zod schema (name, phone, source, consent_purpose, consent_text, optional notes).
- Phone normalized via `normalizeBangladeshPhone`; invalid → 422, never partially stored.
- Retries: n8n-side retry is safe because of Phase 3 idempotency; handler is side-effect-free before receipt claim.

### Phase 3 — Idempotency & canonical dedupe
- New table `n8n_event_receipts` mirroring `messenger_webhook_receipts` (event_key unique + payload_sha256; duplicate vs conflict).
- After receipt claim, call existing `intakeLead({ ownerId: null, source: "n8n" })` — canonical phone dedupe returns `duplicate: true` with current ownership; no second record, no overwrite. Safe upsert = intake's existing semantics; nothing else writes leads.

### Phase 4 — AI BANT scoring (advisory only)
- New pure module `src/lib/lead-bant.ts`: schema `{ budget, authority, need, timeline }` each `{ score, evidence, confidence }`; weights Budget 25 / Authority 20 / Need 30 / Timeline 25; unknown fields stay `null` (never guessed); deterministic validator re-computes the weighted total and rejects mismatches.
- Server: `scoreLeadBant` uses `aiChatJson` with a strict JSON prompt; result validated by the deterministic checker before storage in `lead_bant_scores` (versioned, append-only).
- Rules: no automatic rejection — low scores route to human review queue; every score carries per-field evidence text and confidence; model version recorded like `evaluationAuditDetail`.

### Phase 5 — Agent routing (LeadHub stays canonical)
- BANT score becomes a **signal inside the existing Nexus preview**, not an auto-assigner: `previewLeadCounts` gains an optional score sort; the human review + `assertPreviewUnchanged` + quota + Friday rules are untouched.
- Roster/availability: existing agent roster + `effectiveQuota` remain the only capacity source. HQ lifecycle ownership (approvals, recalls) unchanged.
- Explicitly out of scope: unattended auto-assignment (conflicts with the reviewed-allocation contract — needs an owner decision to change).

### Phase 6 — GHL (optional, secondary, only if explicitly approved)
- GHL may receive a one-way exported copy (outbound only) after CRM intake succeeds; GHL never writes back. No competing canonical records: CRM id is stored as the GHL external reference. Default: not built.

### Phase 7 — Test-only rollout
- Synthetic fixtures + mock n8n webhook payloads only; no real leads/messages. Tests mirror existing webhook suites: signature accept/reject, idempotent replay, phone normalization table, BANT validator (weights, unknowns, mismatch rejection), consent gate, quota/Friday preservation.

### Phase 8 — Acceptance, observability, rollback, gates
- Acceptance tests: end-to-end synthetic webhook → receipt → unassigned lead → BANT score → Nexus preview ordering.
- Observability: reuse audit_logs + lead_events; pipeline metrics row per stage (received/stored/duplicate/scored/routed).
- Rollback: feature flag `N8N_PIPELINE_ENABLED` (env, default off); receipts keep events replayable; no destructive migration.
- Staged gates: (1) code + tests → (2) owner approves consent policy → (3) secret configured → (4) synthetic E2E → (5) limited real pilot with daily review.

## Blockers / decisions needed
1. **Routing contract**: auto-routing conflicts with Nexus's human-reviewed allocation — owner must confirm "score as preview signal" (recommended) or explicitly approve a contract change.
2. **Consent policy**: owner must approve the affirmative opt-in requirement per purpose before any automated outreach.
3. **N8N_WEBHOOK_SECRET**: shared secret, user generates and pastes into n8n (add_secret with generate).
4. **GHL**: excluded unless explicitly approved in writing.
5. Meta Messenger secrets still absent — unrelated to this pipeline but blocks the separate Messenger track.
