/**
 * AI provider selection — pure, browser-safe rules shared by the server
 * helper and tests. No environment reads happen here: the server-only helper
 * passes `process.env` in from inside its handler boundary.
 *
 * Meta Model API (Muse Spark) is an optional, opt-in provider. It is
 * fail-closed: without MODEL_API_KEY in the server environment every call is
 * refused with a generic message, and the key is never logged, returned, or
 * sent anywhere except the provider endpoint.
 */

export type AiModelChoice = "openai" | "gemini" | "meta";

export const AI_MODEL_IDS: Record<AiModelChoice, string> = {
  openai: "openai/gpt-6-astra",
  gemini: "google/gemini-3.8-flash",
  meta: "muse-spark-1.3",
};

export const META_MODEL_API_BASE_URL = "https://api.meta.ai/v1";
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AiProviderConfig = {
  endpoint: string;
  model: string;
  /** Name of the server-only environment variable holding the key. */
  keyEnv: "LOVABLE_API_KEY" | "MODEL_API_KEY";
  /** gpt-6-astra requires an explicit reasoning effort and rejects temperature. */
  reasoningEffort?: "low";
};

/** Stored choice → provider. Unknown/absent values fall back to OpenAI. */
export function parseAiModelChoice(value: unknown): AiModelChoice {
  return value === "gemini" || value === "meta" ? value : "openai";
}

export function resolveAiProvider(choice: AiModelChoice): AiProviderConfig {
  if (choice === "meta") {
    return {
      endpoint: `${META_MODEL_API_BASE_URL}/chat/completions`,
      model: AI_MODEL_IDS.meta,
      keyEnv: "MODEL_API_KEY",
    };
  }
  return {
    endpoint: LOVABLE_GATEWAY,
    model: AI_MODEL_IDS[choice],
    keyEnv: "LOVABLE_API_KEY",
    ...(choice === "openai" ? { reasoningEffort: "low" as const } : {}),
  };
}

/**
 * Presence-only configuration check: true when the provider's server key
 * exists. Never returns or logs the key itself — safe to show in staff UI as
 * a "configured / setup required" badge.
 */
export function isProviderConfigured(
  choice: AiModelChoice,
  env: Record<string, string | undefined>,
): boolean {
  return Boolean(env[resolveAiProvider(choice).keyEnv]);
}

/**
 * Return the provider key or throw a generic, secret-safe message. The error
 * never names or contains the key, and a missing key always refuses the call
 * (fail-closed) rather than falling back to another provider.
 */
export function requireAiKey(
  choice: AiModelChoice,
  env: Record<string, string | undefined>,
): string {
  const config = resolveAiProvider(choice);
  const key = env[config.keyEnv];
  if (!key) {
    throw new Error(
      choice === "meta"
        ? "Meta Model API is not configured"
        : "AI service is not configured",
    );
  }
  return key;
}

/** Error text shown to staff must never carry provider responses or keys. */
export function aiCallFailureMessage(status: number): string {
  if (status === 402 || status === 403) return "AI credits are exhausted — please try again later";
  if (status === 429) return "AI is busy right now — try again in a moment";
  return "The AI service is unavailable right now";
}
