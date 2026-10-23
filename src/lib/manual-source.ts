/**
 * Pure parser for the canonical manual Markdown (docs/CRM_OPERATIONS_MANUAL.md).
 * Shared by the app (/manual), the PDF build scripts and tests — no I/O here.
 */
export type ManualSection = { id: string; title: string; body: string[] };
export type ParsedManual = { title: string; version: string; updated: string; sections: ManualSection[] };

export function parseManual(md: string): ParsedManual {
  const src = md.replace(/\r\n/g, "\n");
  const version = src.match(/<!--\s*manual-version:\s*([\d.]+)\s*-->/)?.[1];
  const updated = src.match(/<!--\s*manual-updated:\s*([\d-]+)\s*-->/)?.[1];
  if (!version || !updated) throw new Error("Manual is missing manual-version / manual-updated markers");
  const title = src.match(/^# (.+)$/m)?.[1]?.trim() ?? "Manual";
  const sections: ManualSection[] = [];
  let cur: ManualSection | null = null;
  for (const line of src.split("\n")) {
    const h = line.match(/^## (.+?)(?:\s*\{#([\w-]+)\})?\s*$/);
    if (h) {
      cur = { id: h[2] ?? h[1]!.toLowerCase().replace(/[^\w]+/g, "-"), title: h[1]!.trim(), body: [] };
      sections.push(cur);
      continue;
    }
    const b = line.match(/^- (.+)$/);
    if (b && cur) cur.body.push(b[1]!);
  }
  return { title, version, updated, sections };
}
