import { describe, expect, it } from "vitest";

import { langFromStored } from "@/lib/i18n";

describe("UI language default", () => {
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
