// One-page brochures split from the official "15 Project Profiles" PDF, stamped with the sales
// phone/email + bilingual call-to-action by scripts/brochures/stamp_contact.py (stored as CDN assets).
const B = "/__l5e/assets-v1/";
const LIST: Array<[string, string]> = [
  ["winstone dream park", "9fab23cd-2436-46b6-8fbc-6b26ca639fc3/winstone-project-01-brochure.pdf"],
  ["silver sun", "c2a790ba-f79d-4572-8923-85b58af37442/winstone-project-02-brochure.pdf"],
  ["kanan hill", "5a53cfd8-f24f-4f13-904b-411dcedaaebc/winstone-project-03-brochure.pdf"],
  ["winstone park shouthern", "ba3b8843-5e56-49dd-975a-fd0f16b70f7b/winstone-project-04-brochure.pdf"],
  ["winstone park southern", "ba3b8843-5e56-49dd-975a-fd0f16b70f7b/winstone-project-04-brochure.pdf"],
  ["dokhonaloy", "b9bd0a28-1472-4e99-9e36-9db62c03263c/winstone-project-05-brochure.pdf"],
  ["winstone lake view height", "751eae37-84e0-4f67-9b3b-64f5adb228da/winstone-project-06-brochure.pdf"],
  ["metro plaza", "4fd680d7-7d65-4cf9-a1cf-9e00af14469d/winstone-project-07-brochure.pdf"],
  ["winstone metro view park", "c7373ea8-535d-4ec5-ba6f-5bd22254e5cd/winstone-project-08-brochure.pdf"],
  ["winstone 1", "d23f0f64-8d59-4fba-abc8-cae3044d155b/winstone-project-09-brochure.pdf"],
  ["winstone 2", "dd0ed018-fa34-42f1-8c6e-6c58fb26e2ab/winstone-project-10-brochure.pdf"],
  ["winstone 3", "ba91fe8a-1015-4bef-8dea-066d59312219/winstone-project-11-brochure.pdf"],
  ["winstone 4", "a4565fb1-e935-4b02-8b46-077390248702/winstone-project-12-brochure.pdf"],
  ["winstone 5", "f42a7372-8e32-4a6c-a758-b44a71c12db4/winstone-project-13-brochure.pdf"],
  ["winstone green view park", "8fcb7434-5d5b-429e-8517-d8727f46982e/winstone-project-14-brochure.pdf"],
  ["winstone park stone", "3bf35388-eab6-469d-a7e9-1e40b9e96bb0/winstone-project-15-brochure.pdf"],
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
