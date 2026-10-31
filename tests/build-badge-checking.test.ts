// @vitest-environment jsdom
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { BuildBadge, BuildBadgeView } from "@/components/crm/BuildBadge";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("version indicator while the address is still being checked", () => {
  it("first server-rendered paint announces Checking before any Live/Preview claim", () => {
    const html = renderToString(React.createElement(BuildBadge));
    expect(html).toContain('data-channel="unknown"');
    expect(html).toMatch(/CRM version: Checking, version \S+, published .+ Dhaka time/);
    expect(html).not.toMatch(/Live|Preview/);
  });

  for (const [lang, sentence, visible] of [
    ["en", /^CRM version: Checking, version \S+, published .+ Dhaka time$/, "Checking"],
    ["bn", /^CRM সংস্করণ: যাচাই হচ্ছে, ভার্সন \S+, প্রকাশিত .+ ঢাকা সময়$/, "যাচাই হচ্ছে"],
  ] as const) {
    it(`screen readers hear the ${lang} Checking sentence`, () => {
      localStorage.setItem("winstone.lang", lang);
      const { getByTestId } = render(React.createElement(BuildBadgeView, { channel: null }));
      const badge = getByTestId("build-badge");
      expect(within(badge).getByTestId("build-badge-sr").textContent).toMatch(sentence);
      expect(within(badge).getByTestId("build-badge-visible").textContent).toContain(visible);
      expect(badge.textContent).not.toMatch(/Live|Preview|লাইভ|প্রিভিউ/);
    });
  }

  it("collapsed sidebar still announces Checking with no visible text", () => {
    localStorage.setItem("winstone.lang", "bn");
    const { getByTestId, queryByTestId } = render(React.createElement(BuildBadgeView, { channel: null, compact: true }));
    expect(queryByTestId("build-badge-visible")).toBeNull();
    expect(getByTestId("build-badge-sr").textContent).toContain("যাচাই হচ্ছে");
  });
});
