/**
 * Page-load diagnostics: pure, browser-safe helpers that turn the existing
 * runtime_error_occurrences + runtime_error_issues rows into display DTOs.
 *
 * Honesty rules:
 * - Only fields the CRM actually persisted are shown. Anything absent is
 *   `null` and renders as "Unknown" / "Not captured" — never guessed.
 * - Browser / OS / device come only from a stored user-agent string. The raw
 *   user agent is a request header, so it is parsed server-side and never
 *   returned to the browser.
 * - Messages and asset URLs are redacted: query strings, fragments, tokens,
 *   emails and phone numbers are stripped before anything leaves the server.
 */

export const UNKNOWN = "Unknown";
export const NOT_CAPTURED = "Not captured";

/** Exact browser text for the iPhone/Safari module-load failure. */
export const IMPORTING_MODULE_MESSAGE = "Importing a module script failed.";
/** Exact text the hosting error tracker receives when the fallback screen shows. */
export const FALLBACK_SHOWN_MESSAGE = "Module load recovery: fallback-shown";

export type RecoveryOutcome =
  | "reload-attempted"
  | "late-retry"
  | "recovered"
  | "fallback-shown"
  | "server-offline"
  | "assets-waiting"
  | "not-triggered"
  | "not-recorded";

export const OUTCOME_LABEL: Record<RecoveryOutcome, string> = {
  "reload-attempted": "Retry / reload attempted",
  "late-retry": "Late retry after server returned",
  recovered: "Recovered",
  "fallback-shown": "Fallback shown (exhausted)",
  "server-offline": "Server offline — fallback shown",
  "assets-waiting": "Asset check: files still missing — fallback shown",
  "not-triggered": "No recovery (error reported only)",
  "not-recorded": "Outcome not recorded",
};

export type MessageClass =
  | "importing-module-script-failed"
  | "failed-to-fetch-dynamic-module"
  | "error-loading-dynamic-module"
  | "unable-to-preload-css"
  | "fallback-shown"
  | "script-load-failed"
  | "stale-server-function"
  | "asset-unavailable"
  | "server-unreachable"
  | "page-down"
  | "other";

export const MESSAGE_CLASS_LABEL: Record<MessageClass, string> = {
  "importing-module-script-failed": IMPORTING_MODULE_MESSAGE,
  "failed-to-fetch-dynamic-module": "Failed to fetch dynamically imported module",
  "error-loading-dynamic-module": "error loading dynamically imported module",
  "unable-to-preload-css": "Unable to preload CSS",
  "fallback-shown": FALLBACK_SHOWN_MESSAGE,
  "script-load-failed": "Startup script element failed to load",
  "stale-server-function": "Invalid server function ID (stale deployment)",
  "asset-unavailable": "Referenced asset unavailable",
  "server-unreachable": "Server unreachable",
  "page-down": "Page unavailable",
  other: "Other error",
};

/** Error kinds produced by the module-load recovery script (deploy-recovery-script.ts). */
export const MODULE_LOAD_KINDS = new Set([
  "preload-error",
  "import-rejected",
  "module-error",
  "caught-route-import",
  "script-load-failed",
  "stale-server-fn",
  "fallback-shown",
  "server-unreachable",
  "assets-unavailable",
  "late-retry",
  "recovered-after-reload",
]);

export type ParsedAgent = {
  browserFamily: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
};

const ver = (v: string | undefined) => (v ? v.replace(/_/g, ".") : UNKNOWN);
const major = (v: string | undefined) => (v ? v.split(".")[0]! : UNKNOWN);

/** Parses a stored user agent. Null/empty/unrecognised input stays "Unknown". */
export function parseUserAgent(ua: string | null | undefined): ParsedAgent {
  const out: ParsedAgent = { browserFamily: UNKNOWN, browserVersion: UNKNOWN, os: UNKNOWN, osVersion: UNKNOWN, device: UNKNOWN };
  const s = typeof ua === "string" ? ua.trim() : "";
  if (!s) return out;

  let m: RegExpMatchArray | null;
  if ((m = s.match(/WinstoneHealthCheck\/([\d.]+)/))) {
    return { browserFamily: "Health check", browserVersion: m[1]!, os: "Server", osVersion: UNKNOWN, device: "Server" };
  }

  // Operating system
  if ((m = s.match(/(iPhone|iPod)[^)]*?OS (\d+[_.\d]*)/))) { out.os = "iOS"; out.osVersion = ver(m[2]); out.device = "Phone"; }
  else if ((m = s.match(/iPad[^)]*?OS (\d+[_.\d]*)/))) { out.os = "iPadOS"; out.osVersion = ver(m[1]); out.device = "Tablet"; }
  else if ((m = s.match(/Android (\d+(?:\.\d+)*)/))) { out.os = "Android"; out.osVersion = m[1]!; out.device = /Mobile/.test(s) ? "Phone" : "Tablet"; }
  else if (/Android/.test(s)) { out.os = "Android"; out.device = /Mobile/.test(s) ? "Phone" : "Tablet"; }
  else if ((m = s.match(/Windows NT (\d+\.\d+)/))) { out.os = "Windows"; out.osVersion = `NT ${m[1]}`; out.device = "Desktop"; }
  else if ((m = s.match(/Mac OS X (\d+[_.\d]*)/))) { out.os = "macOS"; out.osVersion = ver(m[1]); out.device = "Desktop"; }
  else if (/CrOS/.test(s)) { out.os = "ChromeOS"; out.device = "Desktop"; }
  else if (/Linux/.test(s)) { out.os = "Linux"; out.device = "Desktop"; }

  // Browser (most specific token first)
  const rules: [RegExp, string][] = [
    [/EdgA?\/([\d.]+)/, "Edge"],
    [/EdgiOS\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
    [/CriOS\/([\d.]+)/, "Chrome (iOS)"],
    [/FxiOS\/([\d.]+)/, "Firefox (iOS)"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/LovableApp\/([\d.]+)/, "Lovable app (WebView)"],
    [/; wv\).*Chrome\/([\d.]+)/, "Android WebView"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Version\/([\d.]+).*Safari\//, "Safari"],
  ];
  for (const [re, family] of rules) {
    const hit = s.match(re);
    if (hit) { out.browserFamily = family; out.browserVersion = major(hit[1]); return out; }
  }
  if (/AppleWebKit/.test(s) && (out.os === "iOS" || out.os === "iPadOS")) out.browserFamily = "iOS WebView";
  return out;
}

/** Keeps origin + path only. Returns null when the value is not a URL/path. */
export function sanitizeAssetUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = String(raw).trim().split(/[?#]/)[0]!;
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      return `${u.protocol}//${u.host}${u.pathname}`;
    } catch {
      return null;
    }
  }
  return t.startsWith("/") ? t : null;
}

const ASSET_RE = /((?:https?:\/\/[^\s"'<>()]+)?\/assets\/[^\s"'<>()]+)/i;

/** Redacts secrets/PII from a stored message before display. */
export function redactText(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .replace(/https?:\/\/[^\s"'<>()]+/gi, (u) => sanitizeAssetUrl(u) ?? "<url>")
    .replace(/(\/[^\s"'<>()?#]*)\?[^\s"'<>()]*/g, "$1")
    .replace(/#[^\s"'<>()]+/g, "")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "<token>")
    .replace(/\b(?:sb_(?:publishable|secret)_|sk_|pk_|whsec_|ghp_|gho_)[\w-]+/gi, "<token>")
    .replace(/\b(?:bearer|token|apikey|api_key|access_token|password|secret)\s*[:=]\s*\S+/gi, (m) => `${m.split(/[:=]/)[0]}=<redacted>`)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .replace(/(?:\+?880|\b0)1[3-9]\d{8}\b/g, "<phone>")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "<token>")
    .slice(0, 1000);
}

export function classifyMessage(kind: string, detail: string): MessageClass {
  const d = detail || "";
  if (/Importing a module script failed/i.test(d)) return "importing-module-script-failed";
  if (/Failed to fetch dynamically imported module/i.test(d)) return "failed-to-fetch-dynamic-module";
  if (/error loading dynamically imported module/i.test(d)) return "error-loading-dynamic-module";
  if (/Unable to preload CSS/i.test(d)) return "unable-to-preload-css";
  if (/Module load recovery: fallback-shown/i.test(d) || kind === "fallback-shown") return "fallback-shown";
  if (kind === "script-load-failed") return "script-load-failed";
  if (kind === "stale-server-fn") return "stale-server-function";
  if (kind === "assets-unavailable" || kind === "script-unavailable") return "asset-unavailable";
  if (kind === "server-unreachable") return "server-unreachable";
  if (kind === "page-down") return "page-down";
  return "other";
}

/** Maps the stored kind + recovery_outcome column to one recovery outcome. */
export function recoveryOutcome(kind: string, stored: string | null | undefined): RecoveryOutcome {
  if (stored === "recovered" || kind === "recovered-after-reload") return "recovered";
  // Every "failed" path in the recovery script ends on the fallback screen.
  if (stored === "failed") {
    if (kind === "server-unreachable") return "server-offline";
    if (kind === "assets-unavailable") return "assets-waiting";
    return "fallback-shown";
  }
  if (stored === "reloading") return kind === "late-retry" ? "late-retry" : "reload-attempted";
  if (kind === "fallback-shown") return "fallback-shown";
  if (kind === "server-unreachable") return "server-offline";
  if (kind === "assets-unavailable") return "assets-waiting";
  if (kind === "late-retry") return "late-retry";
  // Module-load rows from before the outcome column existed: honestly unknown.
  if (MODULE_LOAD_KINDS.has(kind)) return "not-recorded";
  return "not-triggered";
}

export type OccurrenceRow = {
  id: number | string;
  occurred_at: string;
  route: string | null;
  detail: string | null;
  browser: string | null;
  recovery_outcome: string | null;
  issue: { kind: string | null; source: string | null; message: string | null } | null;
};

export type LoadEvent = {
  id: string;
  occurredAtUtc: string;
  route: string;
  source: string;
  kind: string;
  isModuleLoad: boolean;
  messageClass: MessageClass;
  message: string;
  assetUrl: string | null;
  assetStatus: string | null;
  filename: string | null;
  line: number | null;
  column: number | null;
  outcome: RecoveryOutcome;
} & ParsedAgent;

/** Server-side mapper: the only place raw rows become browser-visible data. */
export function toLoadEvent(row: OccurrenceRow): LoadEvent {
  const kind = (row.issue?.kind || "error").slice(0, 60);
  const source = row.issue?.source || UNKNOWN;
  const rawDetail = row.detail ?? row.issue?.message ?? "";
  const message = redactText(rawDetail) || UNKNOWN;

  const assetMatch = String(rawDetail).match(ASSET_RE);
  const assetUrl = assetMatch ? sanitizeAssetUrl(assetMatch[1]) : null;
  const status = String(rawDetail).match(/HTTP (\d{3})/);
  let assetStatus: string | null = status ? `HTTP ${status[1]}` : null;
  if (!assetStatus && /unreachable/i.test(rawDetail) && assetUrl) assetStatus = "Fetch failed (unreachable)";

  // Runtime errors are stored as "message @ /path/file.js:LINE".
  let filename: string | null = null;
  let line: number | null = null;
  const at = String(rawDetail).match(/ @ (\S+?):(\d+)(?::(\d+))?\s*$/);
  if (at) { filename = sanitizeAssetUrl(at[1]) ?? null; line = Number(at[2]); }
  const column = at?.[3] ? Number(at[3]) : null;

  return {
    id: String(row.id),
    occurredAtUtc: new Date(row.occurred_at).toISOString(),
    route: (row.route || "").split(/[?#]/)[0] || UNKNOWN,
    source,
    kind,
    isModuleLoad: MODULE_LOAD_KINDS.has(kind) || classifyMessage(kind, rawDetail) !== "other",
    messageClass: classifyMessage(kind, rawDetail),
    message,
    assetUrl,
    assetStatus,
    filename,
    line,
    column,
    outcome: recoveryOutcome(kind, row.recovery_outcome),
    ...parseUserAgent(row.browser),
  };
}

const DHAKA_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  year: "numeric", month: "short", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

/** "01 Nov 2026, 12:25:30" in Asia/Dhaka. */
export function formatDhaka(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return UNKNOWN;
  return DHAKA_FMT.format(d);
}

/** Dhaka calendar day (YYYY-MM-DD) or hour bucket (YYYY-MM-DD HH:00). */
export function dhakaBucket(iso: string, unit: "day" | "hour"): string {
  const shifted = new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString();
  return unit === "day" ? shifted.slice(0, 10) : `${shifted.slice(0, 10)} ${shifted.slice(11, 13)}:00`;
}

export type LoadFilters = {
  browser?: string;
  os?: string;
  device?: string;
  route?: string;
  kind?: string;
  outcome?: string;
  moduleOnly?: boolean;
};

export function applyFilters(events: LoadEvent[], f: LoadFilters): LoadEvent[] {
  return events.filter((e) =>
    (!f.browser || `${e.browserFamily} ${e.browserVersion}` === f.browser || e.browserFamily === f.browser) &&
    (!f.os || `${e.os} ${e.osVersion}` === f.os || e.os === f.os) &&
    (!f.device || e.device === f.device) &&
    (!f.route || e.route === f.route) &&
    (!f.kind || e.kind === f.kind) &&
    (!f.outcome || e.outcome === f.outcome) &&
    (!f.moduleOnly || e.isModuleLoad),
  );
}

export type LoadSummary = {
  total: number;
  moduleLoad: number;
  importingModuleScript: number;
  fallbackShown: number;
  recovered: number;
  reloadAttempts: number;
  serverOffline: number;
  assetsWaiting: number;
  missingAssetUrls: number;
  unknownBrowser: number;
  byOutcome: { outcome: RecoveryOutcome; label: string; count: number }[];
  byBrowser: { browser: string; os: string; device: string; count: number; moduleLoad: number; fallback: number }[];
  byMessageClass: { cls: MessageClass; label: string; count: number }[];
  missingAssets: { url: string; status: string; count: number; lastSeenUtc: string }[];
  trend: { bucket: string; total: number; moduleLoad: number; fallback: number; recovered: number }[];
};

const isFallback = (o: RecoveryOutcome) => o === "fallback-shown" || o === "server-offline" || o === "assets-waiting";

export function summarize(events: LoadEvent[], unit: "day" | "hour" = "day"): LoadSummary {
  const outcome = new Map<RecoveryOutcome, number>();
  const browser = new Map<string, LoadSummary["byBrowser"][number]>();
  const cls = new Map<MessageClass, number>();
  const assets = new Map<string, LoadSummary["missingAssets"][number]>();
  const trend = new Map<string, LoadSummary["trend"][number]>();
  let moduleLoad = 0, importing = 0, unknownBrowser = 0;

  for (const e of events) {
    outcome.set(e.outcome, (outcome.get(e.outcome) ?? 0) + 1);
    cls.set(e.messageClass, (cls.get(e.messageClass) ?? 0) + 1);
    if (e.isModuleLoad) moduleLoad++;
    if (e.messageClass === "importing-module-script-failed") importing++;
    if (e.browserFamily === UNKNOWN) unknownBrowser++;

    const bKey = `${e.browserFamily} ${e.browserVersion}|${e.os} ${e.osVersion}|${e.device}`;
    const b = browser.get(bKey) ?? { browser: `${e.browserFamily} ${e.browserVersion}`.replace(` ${UNKNOWN}`, e.browserFamily === UNKNOWN ? "" : ` (version ${UNKNOWN.toLowerCase()})`), os: `${e.os} ${e.osVersion}`.replace(` ${UNKNOWN}`, e.os === UNKNOWN ? "" : ""), device: e.device, count: 0, moduleLoad: 0, fallback: 0 };
    b.count++; if (e.isModuleLoad) b.moduleLoad++; if (isFallback(e.outcome)) b.fallback++;
    browser.set(bKey, b);

    if (e.assetUrl) {
      const status = e.assetStatus ?? NOT_CAPTURED;
      const k = `${e.assetUrl}|${status}`;
      const a = assets.get(k) ?? { url: e.assetUrl, status, count: 0, lastSeenUtc: e.occurredAtUtc };
      a.count++; if (e.occurredAtUtc > a.lastSeenUtc) a.lastSeenUtc = e.occurredAtUtc;
      assets.set(k, a);
    }

    const t = dhakaBucket(e.occurredAtUtc, unit);
    const tr = trend.get(t) ?? { bucket: t, total: 0, moduleLoad: 0, fallback: 0, recovered: 0 };
    tr.total++; if (e.isModuleLoad) tr.moduleLoad++; if (isFallback(e.outcome)) tr.fallback++; if (e.outcome === "recovered") tr.recovered++;
    trend.set(t, tr);
  }

  const n = (o: RecoveryOutcome) => outcome.get(o) ?? 0;
  return {
    total: events.length,
    moduleLoad,
    importingModuleScript: importing,
    fallbackShown: n("fallback-shown") + n("server-offline") + n("assets-waiting"),
    recovered: n("recovered"),
    reloadAttempts: n("reload-attempted") + n("late-retry"),
    serverOffline: n("server-offline"),
    assetsWaiting: n("assets-waiting"),
    missingAssetUrls: new Set([...assets.values()].map((a) => a.url)).size,
    unknownBrowser,
    byOutcome: (Object.keys(OUTCOME_LABEL) as RecoveryOutcome[])
      .map((o) => ({ outcome: o, label: OUTCOME_LABEL[o], count: n(o) }))
      .filter((r) => r.count > 0),
    byBrowser: [...browser.values()].sort((a, b) => b.count - a.count),
    byMessageClass: [...cls.entries()].map(([c, count]) => ({ cls: c, label: MESSAGE_CLASS_LABEL[c], count })).sort((a, b) => b.count - a.count),
    missingAssets: [...assets.values()].sort((a, b) => b.count - a.count),
    trend: [...trend.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
  };
}

function csvCell(v: unknown) {
  let t = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}

/** CSV of the filtered events (already redacted DTOs; formulas neutralised). */
export function eventsToCsv(events: LoadEvent[]): string {
  const head = ["Time (Asia/Dhaka)", "Time (UTC)", "Route", "Source", "Error type", "Message class", "Message", "Asset URL", "Asset status", "File", "Line", "Column", "Recovery outcome", "Browser", "Browser version", "OS", "OS version", "Device"];
  const rows = events.map((e) => [
    formatDhaka(e.occurredAtUtc), e.occurredAtUtc, e.route, e.source, e.kind, MESSAGE_CLASS_LABEL[e.messageClass], e.message,
    e.assetUrl ?? NOT_CAPTURED, e.assetStatus ?? NOT_CAPTURED, e.filename ?? NOT_CAPTURED, e.line ?? NOT_CAPTURED, e.column ?? NOT_CAPTURED,
    OUTCOME_LABEL[e.outcome], e.browserFamily, e.browserVersion, e.os, e.osVersion, e.device,
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}
