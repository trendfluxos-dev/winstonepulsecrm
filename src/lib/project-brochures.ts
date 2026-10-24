// One-page brochures split from the official "15 Project Profiles" PDF, stamped with the sales
// emails + bilingual call-to-action by scripts/brochures/stamp_contact.py (stored as CDN assets).
const B = "/__l5e/assets-v1/";
const LIST: Array<[string, string]> = [
  ["winstone dream park", "7480d895-66e8-44ab-86ee-eff22378d6d3/winstone-project-01-brochure.pdf"],
  ["silver sun", "a69c1de1-246d-4149-807b-d5680a1f90b5/winstone-project-02-brochure.pdf"],
  ["kanan hill", "e0307dc1-004a-483a-b505-62c119a606c3/winstone-project-03-brochure.pdf"],
  ["winstone park shouthern", "11399650-42d2-4046-b493-9fe7ee21093c/winstone-project-04-brochure.pdf"],
  ["winstone park southern", "11399650-42d2-4046-b493-9fe7ee21093c/winstone-project-04-brochure.pdf"],
  ["dokhonaloy", "3c88e172-db55-448e-b609-9ddd1d1d557b/winstone-project-05-brochure.pdf"],
  ["winstone lake view height", "d26156bd-b21e-4b5b-a350-dfb92e9b4e36/winstone-project-06-brochure.pdf"],
  ["metro plaza", "8bb88722-8276-4bbe-b676-00a0cff40f36/winstone-project-07-brochure.pdf"],
  ["winstone metro view park", "29f28257-4ad3-4989-a1f9-b588f0793165/winstone-project-08-brochure.pdf"],
  ["winstone 1", "f513ba92-59e6-41dc-93af-96e2f5fc9112/winstone-project-09-brochure.pdf"],
  ["winstone 2", "ba8e5eab-6899-4e06-bb45-46fab51d2194/winstone-project-10-brochure.pdf"],
  ["winstone 3", "52f3ca91-7c5b-4673-a9dc-68ddbff8a385/winstone-project-11-brochure.pdf"],
  ["winstone 4", "d7a35fe2-3613-40d6-8cbd-3dca49aea0c4/winstone-project-12-brochure.pdf"],
  ["winstone 5", "0c0aefba-5ecd-4b9f-9e0c-4ce712cf99a6/winstone-project-13-brochure.pdf"],
  ["winstone green view park", "97f73f61-c531-4128-a85f-1143381ec241/winstone-project-14-brochure.pdf"],
  ["winstone park stone", "3523a99e-86bb-49f5-a238-1bf9a1227674/winstone-project-15-brochure.pdf"],
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function brochureFor(name: string): { url: string; filename: string } | null {
  const n = norm(name);
  // exact match first (so "Winstone 1" never matches "Winstone 10"-style names), then prefix match
  const hit = LIST.find(([k]) => n === k) ?? LIST.find(([k]) => !/\d$/.test(k) && n.startsWith(k));
  if (!hit) return null;
  return { url: B + hit[1], filename: `${name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-")}-Brochure.pdf` };
}

/**
 * Every distinct brochure in profile order, with the name it carries inside the ZIP.
 * The two "Park Shouthern/Southern" spellings point at one file, so they collapse to one entry.
 */
export function allBrochures(): Array<{ url: string; entry: string }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; entry: string }> = [];
  for (const [key, path] of LIST) {
    if (seen.has(path)) continue;
    seen.add(path);
    const num = /project-(\d+)/.exec(path)?.[1] ?? String(out.length + 1).padStart(2, "0");
    const title = key.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, "-");
    out.push({ url: B + path, entry: `${num}-${title}-Brochure.pdf` });
  }
  return out;
}

/** The chosen subset, kept in profile order; unknown entry names are ignored. */
export function pickBrochures(entries: string[]): Array<{ url: string; entry: string }> {
  const want = new Set(entries);
  return allBrochures().filter((b) => want.has(b.entry));
}
