/**
 * Routine test runs must never reach the real CRM database (preview and live
 * share one). Every request to the backend host is refused and the test that
 * tried it fails, even when app code swallowed the error, or when a Vitest
 * timing quirk handed a concurrent caller the real client instead of a mock.
 *
 * Modes:
 *  - default: every backend request is blocked.
 *  - RUN_LIVE_SCOPE_TESTS=1 (explicit live security/read checks): reads are
 *    allowed, and writes only with the browser key (to prove they are refused).
 *    Any write carrying the server key is still blocked.
 *  - STAGING_E2E=1 with a non-live SUPABASE_URL: guard off (isolated backend).
 */
import { afterEach } from "vitest";

export const LIVE_REF = "siepfegeubbqwhodyxcg";

const backendUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
const stagingMode = process.env["STAGING_E2E"] === "1" && backendUrl !== "" && !backendUrl.includes(LIVE_REF);
const liveScopeMode = process.env["RUN_LIVE_SCOPE_TESTS"] === "1";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const protectedHosts = new Set(
  [process.env["SUPABASE_URL"], process.env["VITE_SUPABASE_URL"]]
    .filter((u): u is string => Boolean(u))
    .flatMap((u) => {
      try {
        return [new URL(u).host];
      } catch {
        return [];
      }
    }),
);

function isProtected(url: URL): boolean {
  return protectedHosts.has(url.host) || url.host.includes(LIVE_REF) || url.host.endsWith(".supabase.co");
}

function carriesServiceKey(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (!serviceKey) return false;
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((v, k) => headers.set(k, v));
  let found = false;
  headers.forEach((v) => {
    if (v.includes(serviceKey)) found = true;
  });
  return found;
}

const blocked: string[] = [];

const realFetch = globalThis.fetch;
if (typeof realFetch === "function" && !stagingMode) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let url: URL | null = null;
    try {
      url = new URL(raw);
    } catch {
      /* relative or invalid: not a backend call */
    }
    if (url && isProtected(url)) {
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const read = method === "GET" || method === "HEAD";
      const allowed = liveScopeMode && (read || !carriesServiceKey(input, init));
      if (!allowed) {
        blocked.push(`${method} ${url.pathname}`);
        throw new Error(`[test-guard] blocked a real database request: ${method} ${url.pathname}`);
      }
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
}

afterEach(() => {
  if (!blocked.length) return;
  const list = blocked.splice(0).join(", ");
  throw new Error(`[test-guard] this test tried to reach the real database: ${list}`);
});
