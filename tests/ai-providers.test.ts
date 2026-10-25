import { describe, expect, it } from "vitest";

import {
  AI_MODEL_IDS,
  META_MODEL_API_BASE_URL,
  aiCallFailureMessage,
  isProviderConfigured,
  parseAiModelChoice,
  requireAiKey,
  resolveAiProvider,
} from "@/lib/ai-providers";

describe("parseAiModelChoice", () => {
  it("keeps the stored meta and gemini choices", () => {
    expect(parseAiModelChoice("meta")).toBe("meta");
    expect(parseAiModelChoice("gemini")).toBe("gemini");
    expect(parseAiModelChoice("openai")).toBe("openai");
  });

  it("falls back to openai for unknown or absent values", () => {
    expect(parseAiModelChoice(undefined)).toBe("openai");
    expect(parseAiModelChoice("claude")).toBe("openai");
    expect(parseAiModelChoice("")).toBe("openai");
  });
});

describe("resolveAiProvider", () => {
  it("routes meta to the Meta Model API with muse-spark-1.3 and MODEL_API_KEY", () => {
    const config = resolveAiProvider("meta");
    expect(config.endpoint).toBe(`${META_MODEL_API_BASE_URL}/chat/completions`);
    expect(config.model).toBe("muse-spark-1.3");
    expect(config.keyEnv).toBe("MODEL_API_KEY");
    expect(config.reasoningEffort).toBeUndefined();
  });

  it("keeps openai and gemini on the Lovable gateway unchanged", () => {
    const openai = resolveAiProvider("openai");
    expect(openai.keyEnv).toBe("LOVABLE_API_KEY");
    expect(openai.model).toBe(AI_MODEL_IDS.openai);
    expect(openai.reasoningEffort).toBe("low");
    const gemini = resolveAiProvider("gemini");
    expect(gemini.keyEnv).toBe("LOVABLE_API_KEY");
    expect(gemini.reasoningEffort).toBeUndefined();
  });
});

describe("requireAiKey — fail-closed, secret-safe", () => {
  it("refuses the meta provider when MODEL_API_KEY is absent", () => {
    expect(() => requireAiKey("meta", {})).toThrow("Meta Model API is not configured");
    expect(() => requireAiKey("meta", { MODEL_API_KEY: "" })).toThrow();
  });

  it("refuses the gateway providers when LOVABLE_API_KEY is absent", () => {
    expect(() => requireAiKey("openai", {})).toThrow("AI service is not configured");
    expect(() => requireAiKey("gemini", {})).toThrow("AI service is not configured");
  });

  it("never falls back to another provider's key", () => {
    // A gateway key must not unlock the meta provider, and vice versa.
    expect(() => requireAiKey("meta", { LOVABLE_API_KEY: "present" })).toThrow();
    expect(() => requireAiKey("openai", { MODEL_API_KEY: "present" })).toThrow();
  });

  it("returns the key when configured", () => {
    expect(requireAiKey("meta", { MODEL_API_KEY: "k" })).toBe("k");
  });
});

describe("isProviderConfigured — presence-only, secret-safe", () => {
  it("reports meta as unconfigured without MODEL_API_KEY", () => {
    expect(isProviderConfigured("meta", {})).toBe(false);
    expect(isProviderConfigured("meta", { MODEL_API_KEY: "" })).toBe(false);
    expect(isProviderConfigured("meta", { MODEL_API_KEY: "k" })).toBe(true);
  });

  it("reports gateway providers by LOVABLE_API_KEY presence only", () => {
    expect(isProviderConfigured("openai", { LOVABLE_API_KEY: "k" })).toBe(true);
    expect(isProviderConfigured("gemini", { LOVABLE_API_KEY: "k" })).toBe(true);
    expect(isProviderConfigured("openai", {})).toBe(false);
  });

  it("never crosses providers — a meta key does not configure the gateway", () => {
    expect(isProviderConfigured("openai", { MODEL_API_KEY: "k" })).toBe(false);
    expect(isProviderConfigured("meta", { LOVABLE_API_KEY: "k" })).toBe(false);
  });
});

describe("aiCallFailureMessage — secret-safe errors", () => {
  it("maps statuses to generic staff-facing messages", () => {
    expect(aiCallFailureMessage(402)).toContain("credits");
    expect(aiCallFailureMessage(403)).toContain("credits");
    expect(aiCallFailureMessage(429)).toContain("busy");
    expect(aiCallFailureMessage(500)).toContain("unavailable");
  });

  it("never carries provider detail or key material", () => {
    for (const status of [400, 401, 402, 403, 429, 500]) {
      const message = aiCallFailureMessage(status);
      expect(message).not.toMatch(/key|token|bearer|authorization/i);
    }
  });
});
