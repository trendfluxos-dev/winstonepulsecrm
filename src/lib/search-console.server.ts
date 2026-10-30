/**
 * Read-only Google Search Console reads via the connector gateway. Only
 * verified properties returned live by Google are ever queried.
 */
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
  if (!lovable || !conn) throw new Error("Search Console connection is not configured");
  return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": conn };
}

async function gsc<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: { ...headers(), "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    console.error(`Search Console read failed [${res.status}]`);
    if (res.status === 403) throw new Error("The connected Google account cannot access this property (HTTP 403)");
    throw new Error(`Search Console read failed (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function listVerifiedProperties(): Promise<string[]> {
  const data = await gsc<{ siteEntry?: { siteUrl: string; permissionLevel?: string }[] }>("/webmasters/v3/sites");
  return (data.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser").map((s) => s.siteUrl);
}

type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

function dhakaDate(offsetDays: number) {
  return new Date(Date.now() + 6 * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10);
}

export async function readSearchPerformance(siteUrl: string) {
  const verified = await listVerifiedProperties();
  if (!verified.includes(siteUrl)) throw new Error("This property is not verified for the connected Google account");
  // Search Console data lags ~2-3 days; use the latest 28 complete days.
  const endDate = dhakaDate(3);
  const startDate = dhakaDate(30);
  const path = `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const q = (body: Record<string, unknown>) => gsc<{ rows?: Row[] }>(path, { method: "POST", body: JSON.stringify({ startDate, endDate, ...body }) });
  const [totals, daily, queries, pages] = await Promise.all([
    q({}),
    q({ dimensions: ["date"] }),
    q({ dimensions: ["query"], rowLimit: 10 }),
    q({ dimensions: ["page"], rowLimit: 10 }),
  ]);
  const t = totals.rows?.[0];
  const map = (r: Row) => ({ key: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });
  return {
    siteUrl, startDate, endDate, checkedAt: new Date().toISOString(),
    totals: { clicks: t?.clicks ?? 0, impressions: t?.impressions ?? 0, ctr: t?.ctr ?? 0, position: t?.position ?? null },
    daily: (daily.rows ?? []).map(map),
    queries: (queries.rows ?? []).map(map),
    pages: (pages.rows ?? []).map(map),
  };
}
