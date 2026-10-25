# AI providers in Winstone CRM

Every CRM AI feature (team summaries, recorder insights, support drafts) goes
through one shared helper: `src/lib/ai-model.server.ts`. HQ picks the provider
once (app_config row `ai`), and every feature follows it. Provider rules live
in `src/lib/ai-providers.ts` (pure, testable, no environment reads).

## Providers

| Choice | Model | Endpoint | Server key |
| --- | --- | --- | --- |
| `openai` (default) | `openai/gpt-6-astra` | Lovable AI Gateway | `LOVABLE_API_KEY` (provisioned by Lovable) |
| `gemini` | `google/gemini-3.8-flash` | Lovable AI Gateway | `LOVABLE_API_KEY` |
| `meta` (opt-in) | `muse-spark-1.3` | `https://api.meta.ai/v1/chat/completions` | `MODEL_API_KEY` |

## Zero-setup default

OpenAI and Gemini run through the Lovable AI Gateway, which is already
provisioned — **no account, key, or manual setup is required**, and `openai`
is the default. These are the recommended choices.

## Enabling Meta Model API (Muse Spark)

Meta is opt-in and needs manual setup. Until then the HQ picker shows it as
**"setup required"** (disabled), and the server refuses to store `meta` as
the active choice — it can never look connected while unconfigured.

1. Obtain a Meta Model API key from your Meta developer account.
2. In Lovable: **Project Settings → Secrets → Add secret**, name it exactly
   `MODEL_API_KEY`, paste the key, save.
3. In the CRM, HQ/IT opens the AI team summary panel and switches the model to
   **Meta (Muse Spark 1.3)** — the option unlocks once the key is present.

Rules that must never change:

- **Never commit the key** to the repository, never paste it in chat, tickets,
  or documents, and never put it in a `VITE_` variable — it is read only from
  the server environment inside the request handler.
- The provider is **fail-closed**: without `MODEL_API_KEY`, every Meta call is
  refused with a generic message. There is no silent fallback to another
  provider, and one provider's key never unlocks another.
- Provider error bodies are never logged or shown (they can echo request
  data); staff see generic status-based messages only.
- After adding the secret, publish the app before expecting the published
  site to use it (the preview reads it immediately).

## Status indicator in the HQ panel

The AI panel shows, for every provider: the active model, the time of the
last **successful** call, and the time of the last **failed** call with its
status and a short reason (e.g. `402 · billing/credits`, `429 · AI busy`,
`500 · service unavailable`, `no usable answer` when the provider never
answered). Times are Dhaka local; the row reads "No failed AI call yet" while
no failure has been recorded.

Only three safe fields are ever stored in the `ai` config row: the model name,
an ISO timestamp, and an HTTP status number (a call that never produced one is
stored as `0`). Provider error bodies, response text, tokens and keys are never
written to the database or shown in the panel, and recording failures is
best-effort — it can never break an AI call.

## Compatibility blocker: Responses API / encrypted reasoning


The Meta quickstart describes the Responses API with
`reasoning.encrypted_content` and high reasoning effort. **The current CRM
adapter is a plain chat-completions HTTP call**, not the Responses API, and
the installed tooling has no Responses-surface adapter for this provider.
Until an adapter exists, those settings are unsupported and deliberately not
sent — the Meta path uses the OpenAI-compatible chat-completions shape only
(`model`, `messages`, `response_format`). Adding encrypted reasoning requires
a reviewed adapter change, not a config flag.

## Google Vertex AI (optional, fourth provider)

- Choice `vertex` → model `google/gemini-2.5-flash` through Vertex AI's OpenAI-compatible chat endpoint (`{location}-aiplatform.googleapis.com`), default location `us-central1` (override with `GOOGLE_VERTEX_LOCATION`).
- Auth: service-account JSON in server-only secret `GOOGLE_VERTEX_SERVICE_ACCOUNT`; `src/lib/vertex-auth.server.ts` mints a short-lived OAuth token (RS256 JWT exchange) with a per-process cache. The JSON, private key and tokens are never logged or returned; all failures are generic messages.
- Fail-closed: without a valid service-account JSON the HQ picker shows "setup required" and every call is refused — no cross-provider fallback.
- Reference: uploaded Vertex AI Agent Platform API docs (aiplatform.googleapis.com).
