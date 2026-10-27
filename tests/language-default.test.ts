import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { langFromStored } from "@/lib/i18n";

describe("UI language default", () => {
  it("keeps the homepage English-only (owner decision 2026-10-27)", () => {
    const home = readFileSync("src/routes/index.tsx", "utf8");
    expect(home).not.toMatch(/[\u0980-\u09ff]/);
    expect(home).not.toContain('lang="bn"');
  });

  it("opens in English when no language was saved", () => {
    expect(langFromStored(null)).toBe("en");
  });

  it("keeps a saved Bengali choice", () => {
    expect(langFromStored("bn")).toBe("bn");
  });

  it("falls back to English for an unexpected stored value", () => {
    expect(langFromStored("fr")).toBe("en");
  });
});
