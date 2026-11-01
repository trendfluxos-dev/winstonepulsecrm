import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDeployRecoveryScript, DEPLOY_RECOVERY_KEY } from "../src/lib/deploy-recovery-script";
import { MODULE_LOAD_ERROR_PATTERN } from "../src/lib/module-load-error";

/**
 * Executes the exact inline recovery script that ships in __root.tsx against a
 * small fake browser, so reload counts and the fallback are asserted directly.
 */
const SAFARI = "Importing a module script failed.";

type Server = { up: boolean; html: string; assets: Set<string>; requests: string[] };

function memoryStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

function response(status: number, body = "") {
  const r = { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body), clone: () => r };
  return r;
}

function boot(opts: { server: Server; session: ReturnType<typeof memoryStorage>; local: ReturnType<typeof memoryStorage>; dev?: boolean }) {
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  const nodes: Record<string, { id: string; remove: () => void }> = {};
  const makeEl = () => {
    const el: Record<string, unknown> & { id: string } = {
      id: "",
      style: {},
      setAttribute: () => {},
      appendChild: (child: { id?: string }) => {
        if (child.id) nodes[child.id] = child as { id: string; remove: () => void };
      },
      focus: () => {},
      remove: () => {
        if (el.id) delete nodes[el.id];
      },
    };
    return el;
  };
  const body = makeEl();
  const document = {
    getElementById: (id: string) => nodes[id] ?? null,
    createElement: makeEl,
    body,
    documentElement: body,
  };
  const location = { pathname: "/", search: "", href: "https://crm.example/", reload: vi.fn(), replace: vi.fn() };
  const lovableReports: string[] = [];
  const fetch = (url: string, init?: { method?: string }) => {
    const method = init?.method ?? "GET";
    opts.server.requests.push(`${method} ${url}`);
    if (!opts.server.up) return Promise.reject(new TypeError("Load failed"));
    if (url.startsWith("/assets/")) return Promise.resolve(response(opts.server.assets.has(url) ? 200 : 404));
    return Promise.resolve(response(200, opts.server.html));
  };
  const window: Record<string, unknown> = {
    sessionStorage: opts.session,
    localStorage: opts.local,
    fetch,
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      (listeners[type] ??= []).push(fn);
    },
    __lovableReportRuntimeError: (e: { message: string }) => lovableReports.push(e.message),
  };
  const navigator = { sendBeacon: vi.fn(() => true) };
  const quiet = { info: () => {}, error: () => {} };
  const src = buildDeployRecoveryScript({ dev: opts.dev ?? false, pattern: MODULE_LOAD_ERROR_PATTERN });
  new Function("window", "document", "location", "navigator", "console", src)(window, document, location, navigator, quiet);
  const emit = (type: string, event: unknown) => (listeners[type] ?? []).forEach((fn) => fn(event));
  return {
    location,
    lovableReports,
    fallbackShown: () => Boolean(nodes["deploy-recovery"]),
    noticeShown: () => Boolean(nodes["deploy-notice"]),
    safariPreloadError: () => emit("vite:preloadError", { payload: { message: SAFARI }, preventDefault: () => {} }),
    scriptLoadFailed: (src: string) => emit("error", { target: { tagName: "SCRIPT", type: "module", src } }),
    booted: () => (window.__clearDeployReloadFlag as () => void)(),
  };
}

const NEW_HTML = '<link rel="modulepreload" href="/assets/index-NEW.js"><script type="module" src="/assets/routes-NEW.js"></script>';

function server(over: Partial<Server> = {}): Server {
  return { up: true, html: NEW_HTML, assets: new Set(["/assets/index-NEW.js", "/assets/routes-NEW.js"]), requests: [], ...over };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("deploy recovery: Safari 'Importing a module script failed.'", () => {
  it("does not reload while a referenced chunk of the new deployment is still missing, then reloads once it exists", async () => {
    const s = server({ assets: new Set(["/assets/index-NEW.js"]) });
    const tab = boot({ server: s, session: memoryStorage(), local: memoryStorage() });
    tab.safariPreloadError();
    expect(tab.noticeShown()).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tab.location.reload).not.toHaveBeenCalled();
    s.assets.add("/assets/routes-NEW.js");
    await vi.advanceTimersByTimeAsync(3_000);
    expect(tab.location.reload).toHaveBeenCalledTimes(1);
  });

  it("coalesces a burst of failures into one recovery run", async () => {
    const s = server();
    const tab = boot({ server: s, session: memoryStorage(), local: memoryStorage() });
    for (let i = 0; i < 4; i++) tab.safariPreloadError();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(s.requests.filter((r) => r === "GET /")).toHaveLength(1);
    expect(tab.location.reload).toHaveBeenCalledTimes(1);
  });

  it("recovers a stale deployment whose old entry script 404s", async () => {
    const s = server();
    const tab = boot({ server: s, session: memoryStorage(), local: memoryStorage() });
    tab.scriptLoadFailed("https://crm.example/assets/index-OLD.js");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(tab.location.reload).toHaveBeenCalledTimes(1);
  });
});

describe("deploy recovery: bounded reloads (production)", () => {
  it("reloads at most 3 times with backoff, then shows the fallback and reports once", async () => {
    const s = server();
    const session = memoryStorage();
    const local = memoryStorage();
    const reloadsAt: number[] = [];
    for (let load = 1; load <= 3; load++) {
      const tab = boot({ server: s, session, local });
      const start = Date.now();
      tab.safariPreloadError();
      await vi.advanceTimersByTimeAsync(6_000);
      expect(tab.location.reload).toHaveBeenCalledTimes(1);
      reloadsAt.push(Date.now() - start);
    }
    // Backoff before reloads 2 and 3 (0s, 2s, 5s plus the 0.3s settle delay).
    const fourth = boot({ server: s, session, local });
    fourth.safariPreloadError();
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    expect(fourth.fallbackShown()).toBe(true);
    expect(fourth.location.reload).not.toHaveBeenCalled();
    expect(fourth.lovableReports).toEqual([`Module load recovery: fallback-shown — ${SAFARI}`]);
  });

  it("reloads the second and third attempts only after the backoff delay", async () => {
    const s = server();
    const session = memoryStorage({ [DEPLOY_RECOVERY_KEY]: "1", [`${DEPLOY_RECOVERY_KEY}:n`]: "2" });
    const tab = boot({ server: s, session, local: memoryStorage() });
    tab.safariPreloadError();
    await vi.advanceTimersByTimeAsync(4_900);
    expect(tab.location.reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(tab.location.reload).toHaveBeenCalledTimes(1);
  });

  it("after the fallback, reloads exactly once when a failing server recovers, never again", async () => {
    const s = server({ up: false });
    const session = memoryStorage({ [DEPLOY_RECOVERY_KEY]: "1", [`${DEPLOY_RECOVERY_KEY}:n`]: "3" });
    const local = memoryStorage();
    const tab = boot({ server: s, session, local });
    tab.safariPreloadError();
    expect(tab.fallbackShown()).toBe(true);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(tab.location.reload).not.toHaveBeenCalled();
    s.up = true;
    await vi.advanceTimersByTimeAsync(16_000);
    expect(tab.location.reload).toHaveBeenCalledTimes(1);

    // The reloaded page fails again: reload budget is spent, the late retry is used.
    for (let load = 1; load <= 3; load++) {
      const again = boot({ server: s, session, local });
      again.safariPreloadError();
      await vi.advanceTimersByTimeAsync(6_000);
    }
    const last = boot({ server: s, session, local });
    last.safariPreloadError();
    s.up = false;
    await vi.advanceTimersByTimeAsync(60_000);
    s.up = true;
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(last.fallbackShown()).toBe(true);
    expect(last.location.reload).not.toHaveBeenCalled();
  });

  it("never auto-reloads from the fallback when the server was healthy all along", async () => {
    const s = server();
    const session = memoryStorage({ [DEPLOY_RECOVERY_KEY]: "1", [`${DEPLOY_RECOVERY_KEY}:n`]: "3" });
    const tab = boot({ server: s, session, local: memoryStorage() });
    tab.safariPreloadError();
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(tab.fallbackShown()).toBe(true);
    expect(tab.location.reload).not.toHaveBeenCalled();
  });

  it("shows the fallback (no blank screen) when the server stays down, and reloads when it returns", async () => {
    const s = server({ up: false });
    const tab = boot({ server: s, session: memoryStorage(), local: memoryStorage() });
    tab.safariPreloadError();
    await vi.advanceTimersByTimeAsync(40_000);
    expect(tab.fallbackShown()).toBe(true);
    expect(tab.lovableReports).toEqual([]);
    s.up = true;
    await vi.advanceTimersByTimeAsync(6_000);
    expect(tab.location.reload).toHaveBeenCalledTimes(1);
  });
});

describe("deploy recovery: user data", () => {
  it("a successful boot clears only the recovery keys and keeps sign-in and offline work", async () => {
    const session = memoryStorage({
      [DEPLOY_RECOVERY_KEY]: "1",
      [`${DEPLOY_RECOVERY_KEY}:n`]: "2",
      [`${DEPLOY_RECOVERY_KEY}:late`]: "1",
      "draft-report": "keep",
    });
    const local = memoryStorage({ "sb-project-auth-token": "{session}", "winstone-offline-queue": "[1]" });
    const tab = boot({ server: server(), session, local });
    tab.booted();
    expect(session.dump()).toEqual({ "draft-report": "keep" });
    expect(local.dump()["sb-project-auth-token"]).toBe("{session}");
    expect(local.dump()["winstone-offline-queue"]).toBe("[1]");
  });
});

describe("offline shell service worker", () => {
  function loadWorker() {
    const handlers: Record<string, (e: unknown) => void> = {};
    const self = { addEventListener: (t: string, fn: (e: unknown) => void) => (handlers[t] = fn), location: { origin: "https://crm.example" } };
    new Function("self", "caches", readFileSync("public/sw.js", "utf8"))(self, {});
    return (path: string) => {
      const respondWith = vi.fn();
      handlers.fetch({ request: { method: "GET", url: `https://crm.example${path}`, mode: "no-cors" }, respondWith });
      return respondWith.mock.calls.length > 0;
    };
  }

  it("never serves unhashed dev-server entry modules from its cache", () => {
    const handled = loadWorker();
    expect(handled("/@oj-start/client-entry.js")).toBe(false);
    expect(handled("/@vite/client")).toBe(false);
    expect(handled("/src/routes/index.tsx")).toBe(false);
    expect(handled("/api/public/telemetry/runtime-error")).toBe(false);
  });

  it("still serves hashed build assets for the offline shell", () => {
    expect(loadWorker()("/assets/index-NEW.js")).toBe(true);
  });
});
