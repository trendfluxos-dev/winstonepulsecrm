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

## Compatibility blocker: Responses API / encrypted reasoning

The Meta quickstart describes the Responses API with
`reasoning.encrypted_content` and high reasoning effort. **The current CRM
adapter is a plain chat-completions HTTP call**, not the Responses API, and
the installed tooling has no Responses-surface adapter for this provider.
Until an adapter exists, those settings are unsupported and deliberately not
sent — the Meta path uses the OpenAI-compatible chat-completions shape only
(`model`, `messages`, `response_format`). Adding encrypted reasoning requires
a reviewed adapter change, not a config flag.
