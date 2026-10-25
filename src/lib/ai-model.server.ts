/**
 * Shared AI gateway helper. One model switch for every CRM AI feature:
 * HQ picks OpenAI, Gemini or Meta (Muse Spark) once (app_config row id "ai")
 * and every feature follows it. Keys stay server-side: OpenAI/Gemini go
 * through the Lovable AI Gateway with LOVABLE_API_KEY; Meta goes to the
 * Meta Model API with MODEL_API_KEY. A missing key refuses the call —
 * there is no silent fallback to another provider.
 */
import {
  isProviderConfigured,
  parseAiModelChoice,
  requireAiKey,
  resolveAiProvider,
  aiCallFailureMessage,
  withLastFailure,
  withLastSuccess,
  type AiModelChoice,
} from "@/lib/ai-providers";

/** Best-effort status recording for the HQ indicator; never breaks AI calls. */
async function recordAiStatus(
  merge: (data: unknown) => Record<string, unknown>,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("data")
      .eq("id", "ai")
      .maybeSingle();
    await supabaseAdmin.from("app_config").upsert({
      id: "ai",
      data: merge(data?.data),
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Status recording is optional telemetry — ignore failures.
  }
}

export type { AiModelChoice };

export async function getAiModelChoice(): Promise<AiModelChoice> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("data")
    .eq("id", "ai")
    .maybeSingle();
  const value = (data?.data as { model?: string } | null)?.model;
  return parseAiModelChoice(value);
}

/**
 * Current choice plus presence-only configuration flags, so staff UI can mark
 * a provider as "setup required" instead of letting it look connected.
 */
export async function getAiModelStatus(): Promise<{
  model: AiModelChoice;
  metaConfigured: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorStatus: number | null;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("data")
    .eq("id", "ai")
    .maybeSingle();
  const config = (data?.data ?? null) as {
    model?: string;
    last_success_at?: string;
    last_error_at?: string;
    last_error_status?: number;
  } | null;
  return {
    model: parseAiModelChoice(config?.model),
    metaConfigured: isProviderConfigured("meta", process.env),
    lastSuccessAt: typeof config?.last_success_at === "string" ? config.last_success_at : null,
    lastErrorAt: typeof config?.last_error_at === "string" ? config.last_error_at : null,
    lastErrorStatus: typeof config?.last_error_status === "number" ? config.last_error_status : null,
  };
}

export async function setAiModelChoice(model: AiModelChoice): Promise<void> {
  // Fail-closed at the write path too: an unconfigured provider must not be
  // stored as the active choice, or every AI feature would start failing.
  if (!isProviderConfigured(model, process.env)) {
    throw new Error(
      model === "meta"
        ? "Meta Model API is not configured"
        : "AI service is not configured",
    );
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("app_config")
    .upsert({ id: "ai", data: { model }, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** One JSON-mode chat call through the selected provider. Throws a safe message on failure. */
export async function aiChatJson<T>(args: { system: string; user: string }): Promise<T> {
  const choice = await getAiModelChoice();
  const provider = resolveAiProvider(choice);
  const key = requireAiKey(choice, process.env);

  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: { type: "json_object" },
  };
  if (provider.reasoningEffort) body["reasoning_effort"] = provider.reasoningEffort;

  const res = await fetch(provider.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Status only — provider error bodies can echo request data and must
    // never reach logs or staff screens.
    console.error("ai provider error", choice, res.status);
    await recordAiStatus((data) => withLastFailure(data, new Date().toISOString(), res.status));
    throw new Error(aiCallFailureMessage(res.status));
  }
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(text) as T;
    await recordAiStatus((data) => withLastSuccess(data, new Date().toISOString()));
    return parsed;
  } catch {
    throw new Error("The AI returned an unreadable answer — please retry");
  }
}
