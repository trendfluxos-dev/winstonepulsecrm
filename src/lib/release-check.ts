import { MANUAL_VERSION } from "@/lib/system-manual";

/** Live-site markers a release must show on /manual before it counts as deployed. */
export const RELEASE_MARKERS = [
  { id: "version", label: `Manual version ${MANUAL_VERSION}`, needle: MANUAL_VERSION },
  { id: "charge", label: "$35.29 monthly charge", needle: "$35.29" },
  { id: "quota", label: "50-lead daily limit", needle: "exactly 50 unique leads" },
] as const;

export type MarkerResult = { id: string; label: string; ok: boolean };

/** Pure check of a fetched /manual HTML body. Deployed only if every marker is present. */
export function evaluateManualHtml(html: string): { deployed: boolean; results: MarkerResult[]; liveVersion: string | null } {
  const text = html.replace(/<!--.*?-->/gs, "");
  const results = RELEASE_MARKERS.map((m) => ({ id: m.id, label: m.label, ok: text.includes(m.needle) }));
  const match = text.match(/Manual version\s*(?:<[^>]*>\s*)*(\d+\.\d+\.\d+)/);
  const liveVersion = match?.[1] ?? null;
  const versionOk = liveVersion === MANUAL_VERSION;
  results[0] = { ...results[0]!, ok: versionOk };
  return { deployed: results.every((r) => r.ok), results, liveVersion };
}
