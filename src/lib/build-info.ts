import { MANUAL_VERSION } from "@/lib/system-manual";

declare const __BUILD_STAMP__: string | undefined;

/** ISO time this bundle was built (set by vite define); null in tests. */
export const BUILD_STAMP: string | null =
  typeof __BUILD_STAMP__ === "string" ? __BUILD_STAMP__ : null;

export const APP_VERSION = MANUAL_VERSION;

const LIVE_HOSTS = new Set(["crm.winstonebd.com", "winstonepulsecrm.lovable.app"]);

export type BuildChannel = "live" | "preview";

export function buildChannel(hostname: string): BuildChannel {
  return LIVE_HOSTS.has(hostname.toLowerCase()) ? "live" : "preview";
}

/** "31 Oct 19:05" in Dhaka time. */
export function formatBuildStamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
