import { describe, expect, it } from "vitest";

import {
  AI_MODEL_IDS,
  AI_NO_RESPONSE_STATUS,
  META_MODEL_API_BASE_URL,
  aiCallFailureMessage,
  aiFailureLabel,

  isProviderConfigured,
  parseAiModelChoice,
  requireAiKey,
  resolveAiProvider,
  withLastFailure,
  withLastSuccess,
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

describe("withLastSuccess — status indicator data", () => {
  it("preserves the stored model choice while adding the timestamp", () => {
    expect(withLastSuccess({ model: "meta" }, "2026-10-25T01:00:00Z")).toEqual({
      model: "meta",
      last_success_at: "2026-10-25T01:00:00Z",
      history: [{ at: "2026-10-25T01:00:00Z", ok: true }],
    });
  });

  it("works with empty or malformed existing config", () => {
    expect(withLastSuccess(null, "t")).toEqual({
      last_success_at: "t",
      history: [{ at: "t", ok: true }],
    });
    expect(withLastSuccess({ model: 42 }, "t")).toEqual({
      last_success_at: "t",
      history: [{ at: "t", ok: true }],
    });
  });

  it("stores only the model name, timestamp and safe history — never key material", () => {
    const merged = withLastSuccess({ model: "meta", secret: "x", key: "y" }, "t");
    expect(Object.keys(merged).sort()).toEqual(["history", "last_success_at", "model"]);
  });
});

describe("withLastFailure — billing hint data", () => {
  it("records status and time while preserving model and success timestamp", () => {
    expect(
      withLastFailure({ model: "meta", last_success_at: "s" }, "2026-10-25T01:30:00Z", 402),
    ).toEqual({
      model: "meta",
      last_success_at: "s",
      last_error_at: "2026-10-25T01:30:00Z",
      last_error_status: 402,
      history: [{ at: "2026-10-25T01:30:00Z", ok: false, status: 402 }],
    });
  });

  it("stores only safe fields — never error bodies or key material", () => {
    const merged = withLastFailure({ model: "meta", body: "raw", key: "k" }, "t", 403);
    expect(Object.keys(merged).sort()).toEqual([
      "history",
      "last_error_at",
      "last_error_status",
      "model",
    ]);
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

describe("aiFailureLabel — safe failure reason for staff UI", () => {
  it("gives every recorded status a short reason", () => {
    expect(aiFailureLabel(AI_NO_RESPONSE_STATUS).en).toContain("no usable answer");
    expect(aiFailureLabel(401).en).toContain("access not accepted");
    expect(aiFailureLabel(402).en).toContain("billing");
    expect(aiFailureLabel(403).en).toContain("billing");
    expect(aiFailureLabel(429).en).toContain("busy");
    expect(aiFailureLabel(500).en).toContain("unavailable");
    expect(aiFailureLabel(400).en).toContain("refused");
  });

  it("carries no key material in either language", () => {
    for (const status of [0, 400, 401, 402, 403, 429, 500]) {
      const { bn, en } = aiFailureLabel(status);
      expect(`${bn} ${en}`).not.toMatch(/key|token|bearer|authorization/i);
    }
  });

  it("always answers in both languages so the panel can switch safely", () => {
    for (const status of [0, 400, 402, 429, 500]) {
      const { bn, en } = aiFailureLabel(status);
      expect(bn.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
    }
  });
});

describe("withLastFailure — status normalisation", () => {
  it("normalises non-HTTP statuses to the no-response marker", () => {
    expect(withLastFailure({ model: "meta" }, "t", NaN).last_error_status).toBe(
      AI_NO_RESPONSE_STATUS,
    );
    expect(withLastFailure({ model: "meta" }, "t", Infinity).last_error_status).toBe(
      AI_NO_RESPONSE_STATUS,
    );
    expect(withLastFailure({ model: "meta" }, "t", 402.7).last_error_status).toBe(402);
  });

  it("keeps the success timestamp when a later failure is recorded", () => {
    expect(
      withLastFailure({ model: "openai", last_success_at: "s" }, "2026-10-25T01:30:00Z", AI_NO_RESPONSE_STATUS),
    ).toEqual({
      model: "openai",
      last_success_at: "s",
      last_error_at: "2026-10-25T01:30:00Z",
      last_error_status: AI_NO_RESPONSE_STATUS,
      history: [{ at: "2026-10-25T01:30:00Z", ok: false, status: AI_NO_RESPONSE_STATUS }],
    });
  });
});

describe("AI call history — safe rolling window", () => {
  it("keeps newest first and caps the window at the limit", () => {
    let data: unknown = { model: "meta" };
    for (let i = 1; i <= 12; i++) {
      data =
        i % 2 === 0
          ? withLastFailure(data, `t${i}`, 402)
          : withLastSuccess(data, `t${i}`);
    }
    const history = readAiHistory(data);
    expect(history).toHaveLength(AI_HISTORY_LIMIT);
    expect(history[0]).toEqual({ at: "t12", ok: false, status: 402 });
    expect(history[1]).toEqual({ at: "t11", ok: true });
    expect(history.at(-1)?.at).toBe("t3");
  });

  it("a success keeps the earlier failure markers and appends to history", () => {
    const failed = withLastFailure({ model: "meta" }, "f", 500);
    const merged = withLastSuccess(failed, "s");
    expect(merged.last_error_at).toBe("f");
    expect(merged.last_error_status).toBe(500);
    expect(merged.history).toEqual([
      { at: "s", ok: true },
      { at: "f", ok: false, status: 500 },
    ]);
  });

  it("readAiHistory drops malformed entries and non-finite statuses", () => {
    const history = readAiHistory({
      history: [
        { at: "a", ok: true },
        { at: "b", ok: false, status: 402.7 },
        { at: "c", ok: false, status: Number.NaN },
        { ok: true },
        { at: 5, ok: false },
        "junk",
        null,
      ],
    });
    expect(history).toEqual([
      { at: "a", ok: true },
      { at: "b", ok: false, status: 402 },
      { at: "c", ok: false },
    ]);
  });

  it("history entries never carry prompts, answers or key material", () => {
    const merged = withLastFailure(
      { model: "meta", history: [{ at: "x", ok: true, prompt: "p", key: "k" }] },
      "t",
      403,
    );
    for (const entry of merged.history) {
      expect(Object.keys(entry).sort()).toEqual(
        entry.ok ? ["at", "ok"] : ["at", "ok", "status"],
      );
    }
  });
});

