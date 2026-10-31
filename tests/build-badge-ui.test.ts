// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, activeOptions: _a, activeProps: _p, ...rest }: { children?: React.ReactNode; to: string; activeOptions?: unknown; activeProps?: unknown }) =>
    React.createElement("a", { href: to, ...rest }, children),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: "/desk", search: {} } }),
}));
vi.mock("@/lib/session", () => ({
  useMyAccount: () => ({ account: { profile: { name: "Test Agent", employee_id: "E1" } }, scope: "agent" }),
  useSignOut: () => () => {},
}));
vi.mock("@/assets/winstone-emblem.png.asset.json", () => ({ default: { url: "/logo.png" } }));

import { NavSidebar, MobileNavDrawer } from "@/components/crm/NavSidebar";
import { MANUAL_VERSION } from "@/lib/system-manual";

const items = [{ to: "/desk", label: "My desk" }] as const;

function setHost(hostname: string) {
  vi.stubGlobal("location", { ...window.location, hostname });
}

beforeEach(() => localStorage.setItem("winstone.lang", "en"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function badgeIn(container: HTMLElement) {
  const badge = await within(container).findByTestId("build-badge");
  await within(badge).findByText(/^(Live|Preview)$/);
  return badge;
}

describe("version indicator in the desktop sidebar", () => {
  it("shows Live with the version on the live CRM address", async () => {
    setHost("crm.winstonebd.com");
    const { container } = render(React.createElement(NavSidebar, { items }));
    const badge = await badgeIn(container);
    expect(badge.textContent).toContain("Live");
    expect(badge.textContent).toContain(`v${MANUAL_VERSION}`);
    expect(badge.getAttribute("title")).toMatch(/Dhaka time$/);
  });

  it("shows Preview on a preview address", async () => {
    setHost("id-preview--990267f3-4198-4d83-ae21-7d9c802617f4.lovable.app");
    const { container } = render(React.createElement(NavSidebar, { items }));
    const badge = await badgeIn(container);
    expect(badge.textContent).toContain("Preview");
    expect(badge.textContent).not.toContain("Live");
  });
});

describe("version indicator in the mobile menu", () => {
  for (const [host, label] of [
    ["crm.winstonebd.com", "Live"],
    ["localhost", "Preview"],
  ] as const) {
    it(`shows ${label} after opening the menu on ${host}`, async () => {
      setHost(host);
      render(React.createElement(MobileNavDrawer, { items }));
      expect(screen.queryByTestId("build-badge")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Open navigation menu/ }));
      const dialog = await screen.findByRole("dialog");
      const badge = await badgeIn(dialog);
      expect(within(badge).getByText(label)).toBeTruthy();
      expect(badge.textContent).toContain(`v${MANUAL_VERSION}`);
    });
  }
});

describe("version indicator accessibility", () => {
  for (const [lang, host, sentence] of [
    ["en", "crm.winstonebd.com", /^CRM version: Live, version \S+, published .+ Dhaka time$/],
    ["en", "localhost", /^CRM version: Preview, version \S+, published .+ Dhaka time$/],
    ["bn", "crm.winstonebd.com", /^CRM সংস্করণ: লাইভ, ভার্সন \S+, প্রকাশিত .+ ঢাকা সময়$/],
  ] as const) {
    it(`screen readers hear one full sentence (${lang}, ${host})`, async () => {
      localStorage.setItem("winstone.lang", lang);
      setHost(host);
      const { container } = render(React.createElement(NavSidebar, { items }));
      const badge = await within(container).findByTestId("build-badge");
      const sr = await within(badge).findByTestId("build-badge-sr");
      await within(badge).findByText(sentence);
      expect(sr.className).toContain("sr-only");
      // Visible shorthand and the dot are hidden from screen readers so nothing is read twice.
      expect(within(badge).getByTestId("build-badge-visible").getAttribute("aria-hidden")).toBe("true");
      expect(badge.querySelector("span.rounded-full")?.getAttribute("aria-hidden")).toBe("true");
    });
  }

  it("never relies on colour alone: the status word is visible text", async () => {
    setHost("crm.winstonebd.com");
    const { container } = render(React.createElement(NavSidebar, { items }));
    const badge = await within(container).findByTestId("build-badge");
    const visible = await within(badge).findByTestId("build-badge-visible");
    await within(visible).findByText("Live");
  });
});
