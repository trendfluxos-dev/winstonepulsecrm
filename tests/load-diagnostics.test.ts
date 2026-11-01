import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ scope: "authority" as string, readOnly: true, from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { inputValidator: (_v: unknown) => chain, handler: (fn: (i: unknown) => unknown) => fn };
    return chain;
  },
}));
vi.mock("@/lib/access.server", () => ({
  resolveCaller: async () => ({ scope: state.scope, readOnly: state.readOnly, userId: "u" }),
  requireAuthority: (c: { scope: string }) => { if (c.scope !== "authority") throw new Error("Master PIN required"); },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: state.from } }));

import {
  FALLBACK_SHOWN_MESSAGE,
  UNKNOWN,
  eventsToCsv,
  formatDhaka,
  parseUserAgent,
  redactText,
  sanitizeAssetUrl,
  summarize,
  toLoadEvent,
  type OccurrenceRow,
} from "@/lib/load-diagnostics";
import { listLoadDiagnostics } from "@/lib/load-diagnostics.functions";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LovableApp/1.2.3";
const ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36";

const row = (o: Partial<OccurrenceRow> & { kind: string }): OccurrenceRow => ({
  id: o.id ?? 1,
  occurred_at: o.occurred_at ?? "2026-11-01T06:25:30.290Z",
  route: o.route ?? "/",
  detail: o.detail ?? null,
  browser: o.browser ?? null,
  recovery_outcome: o.recovery_outcome ?? null,
  issue: { kind: o.kind, source: "browser", message: o.detail ?? null },
});

describe("module-load failure", () => {
  it("classifies the exact iPhone message and keeps it verbatim", () => {
    const e = toLoadEvent(row({ kind: "preload-error", detail: "Importing a module script failed.", browser: IPHONE, recovery_outcome: "reloading" }));
    expect(e.messageClass).toBe("importing-module-script-failed");
    expect(e.message).toBe("Importing a module script failed.");
    expect(e.isModuleLoad).toBe(true);
    expect(e.outcome).toBe("reload-attempted");
    expect(e.os).toBe("iOS");
    expect(e.osVersion).toBe("18.7");
    expect(e.device).toBe("Phone");
  });

  it("treats a failed recovery as the fallback screen and the literal fallback text as fallback-shown", () => {
    expect(toLoadEvent(row({ kind: "preload-error", detail: "Importing a module script failed.", recovery_outcome: "failed" })).outcome).toBe("fallback-shown");
    const lit = toLoadEvent(row({ kind: "runtime-error", detail: `${FALLBACK_SHOWN_MESSAGE} — Importing a module script failed.` }));
    expect(lit.messageClass).toBe("importing-module-script-failed");
    const lit2 = toLoadEvent(row({ kind: "runtime-error", detail: `${FALLBACK_SHOWN_MESSAGE} — x` }));
    expect(lit2.messageClass).toBe("fallback-shown");
  });
});

describe("missing asset URL", () => {
  it("extracts the full asset URL from a script-load failure without inventing a status", () => {
    const e = toLoadEvent(row({ kind: "script-load-failed", detail: "https://crm.winstonebd.com/assets/index-BQIAOxU1.js", browser: ANDROID }));
    expect(e.assetUrl).toBe("https://crm.winstonebd.com/assets/index-BQIAOxU1.js");
    expect(e.assetStatus).toBeNull();
  });
  it("captures HTTP status when the health check stored it", () => {
    const e = toLoadEvent(row({ kind: "script-unavailable", detail: "Startup script failed (HTTP 404, text/html): /assets/main-abc.js" }));
    expect(e.assetUrl).toBe("/assets/main-abc.js");
    expect(e.assetStatus).toBe("HTTP 404");
    expect(summarize([e]).missingAssets[0]).toMatchObject({ url: "/assets/main-abc.js", status: "HTTP 404", count: 1 });
  });
});

describe("recovery outcome grouping", () => {
  it("groups each stored outcome into the right bucket", () => {
    const ev = [
      row({ id: 1, kind: "preload-error", recovery_outcome: "reloading" }),
      row({ id: 2, kind: "preload-error", recovery_outcome: "reloading" }),
      row({ id: 3, kind: "late-retry", recovery_outcome: "reloading" }),
      row({ id: 4, kind: "script-load-failed", recovery_outcome: "recovered" }),
      row({ id: 5, kind: "preload-error", recovery_outcome: "failed" }),
      row({ id: 6, kind: "server-unreachable" }),
      row({ id: 7, kind: "assets-unavailable" }),
      row({ id: 8, kind: "preload-error" }),
      row({ id: 9, kind: "runtime-error", detail: "TypeError: x is undefined" }),
    ].map(toLoadEvent);
    const s = summarize(ev);
    const by = Object.fromEntries(s.byOutcome.map((o) => [o.outcome, o.count]));
    expect(by).toEqual({
      "reload-attempted": 2, "late-retry": 1, recovered: 1, "fallback-shown": 1,
      "server-offline": 1, "assets-waiting": 1, "not-recorded": 1, "not-triggered": 1,
    });
    expect(s.reloadAttempts).toBe(3);
    expect(s.fallbackShown).toBe(3);
    expect(s.recovered).toBe(1);
  });
});

describe("unknown browser", () => {
  it("never guesses when the user agent is absent or unrecognised", () => {
    for (const ua of [null, "", "curl-ish"]) {
      const p = parseUserAgent(ua);
      expect(p.browserFamily).toBe(UNKNOWN);
      expect(p.browserVersion).toBe(UNKNOWN);
      expect(p.device).toBe(UNKNOWN);
    }
    expect(parseUserAgent(null).os).toBe(UNKNOWN);
    const s = summarize([toLoadEvent(row({ kind: "preload-error", browser: null }))]);
    expect(s.unknownBrowser).toBe(1);
    expect(s.byBrowser[0]).toMatchObject({ browser: UNKNOWN, os: UNKNOWN, device: UNKNOWN });
  });
  it("parses Android Chrome and the iPhone app WebView", () => {
    expect(parseUserAgent(ANDROID)).toMatchObject({ browserFamily: "Chrome", browserVersion: "156", os: "Android", osVersion: "10", device: "Phone" });
    expect(parseUserAgent(IPHONE)).toMatchObject({ browserFamily: "Lovable app (WebView)", browserVersion: "1" });
  });
});

describe("Dhaka timestamps", () => {
  it("renders UTC 06:25:30 as 12:25:30 Asia/Dhaka and keeps raw UTC", () => {
    expect(formatDhaka("2026-11-01T06:25:30.290Z")).toBe("01 Nov 2026, 12:25:30");
    expect(formatDhaka("2026-10-31T20:50:28.909Z")).toBe("01 Nov 2026, 02:50:28");
    const e = toLoadEvent(row({ kind: "preload-error", occurred_at: "2026-11-01 06:25:30.290383+00" }));
    expect(e.occurredAtUtc).toBe("2026-11-01T06:25:30.290Z");
    expect(eventsToCsv([e])).toContain('"01 Nov 2026, 12:25:30","2026-11-01T06:25:30.290Z"');
  });
});

describe("redaction", () => {
  it("strips query strings/fragments from asset URLs", () => {
    expect(sanitizeAssetUrl("https://crm.winstonebd.com/assets/a.js?token=abc#x")).toBe("https://crm.winstonebd.com/assets/a.js");
    const e = toLoadEvent(row({ kind: "script-load-failed", detail: "https://crm.winstonebd.com/assets/a.js?access_token=SECRET123" }));
    expect(e.assetUrl).toBe("https://crm.winstonebd.com/assets/a.js");
    expect(e.message).not.toContain("SECRET123");
  });
  it("removes tokens, emails and phone numbers from messages", () => {
    const t = redactText("fail eyJhbGciOi.eyJzdWIi.sig user a@b.com phone 01712345678 +8801812345678 Bearer=abc /x?y=1 sb_secret_xyz");
    expect(t).not.toMatch(/eyJhbGciOi|a@b\.com|01712345678|8801812345678|y=1|sb_secret_xyz/);
    expect(t).toContain("<token>");
    expect(t).toContain("<email>");
    expect(t).toContain("<phone>");
  });
  it("never returns the raw user agent", () => {
    const e = toLoadEvent(row({ kind: "preload-error", browser: ANDROID })) as unknown as Record<string, unknown>;
    expect(JSON.stringify(e)).not.toContain("Mozilla/5.0");
    expect(e.browser).toBeUndefined();
  });
  it("neutralises spreadsheet formulas in CSV", () => {
    const e = toLoadEvent(row({ kind: "runtime-error", detail: "=HYPERLINK(1)" }));
    expect(eventsToCsv([e])).toContain(`"'=HYPERLINK(1)"`);
  });
});

describe("access", () => {
  const input = { fromIso: "2026-10-25T00:00:00.000Z", toIso: "2026-11-01T00:00:00.000Z" };
  beforeEach(() => { state.from.mockReset(); });
  it.each(["agent", "coordinator", "none"])("denies %s before any database read", async (scope) => {
    state.scope = scope;
    await expect((listLoadDiagnostics as unknown as (i: { data: unknown }) => Promise<unknown>)({ data: input })).rejects.toThrow("Master PIN required");
    expect(state.from).not.toHaveBeenCalled();
  });
  it("lets read-only HQ authority read, using only a select (no writes)", async () => {
    state.scope = "authority";
    const calls: string[] = [];
    const q: Record<string, unknown> = {};
    for (const m of ["select", "gte", "lt", "eq", "order"]) q[m] = (..._a: unknown[]) => { calls.push(m); return q; };
    q.range = async () => ({ data: [row({ kind: "preload-error", detail: "Importing a module script failed.", browser: IPHONE })], error: null });
    state.from.mockReturnValue(q);
    const r = (await (listLoadDiagnostics as unknown as (i: { data: unknown }) => Promise<{ events: { messageClass: string }[]; capped: boolean }>)({ data: input }));
    expect(state.from).toHaveBeenCalledWith("runtime_error_occurrences");
    expect(calls).not.toContain("insert");
    expect(r.events[0]!.messageClass).toBe("importing-module-script-failed");
    expect(r.capped).toBe(false);
  });
});
