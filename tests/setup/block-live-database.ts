/**
 * Routine test runs must never reach the real CRM database (preview and live
 * share one). Every request to the project's backend host is refused and the
 * test that tried it fails, even when the app code swallowed the error, or when
 * a Vitest timing quirk handed a concurrent caller the real client instead of a mock.
 *
 * The only exception: a file that calls allowLiveReads() may make read-only
 * GET/HEAD requests (the existing opt-in live read checks). Writes are always
 * refused. The staging suite uses its own config and is not affected.
 */
import { afterEach } from "vitest";

const LIVE_REF = "siepfegeubbqwhodyxcg";

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

const blocked: string[] = [];
let liveReadsAllowed = false;

/** Opt-in for files whose purpose is a read-only check of the live backend. */
export function allowLiveReads() {
  liveReadsAllowed = true;
}

const realFetch = globalThis.fetch;
if (typeof realFetch === "function") {
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
      if (!(liveReadsAllowed && (method === "GET" || method === "HEAD"))) {
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
