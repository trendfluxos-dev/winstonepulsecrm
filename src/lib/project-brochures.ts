// One-page brochures split from the official "15 Project Profiles" PDF (stored as CDN assets).
const B = "/__l5e/assets-v1/";
const LIST: Array<[string, string]> = [
  ["winstone dream park", "18fbf6b2-9b74-4667-841f-2a6acf771e98/winstone-project-01-brochure.pdf"],
  ["silver sun", "74322356-82e0-4e74-9b08-1b694336e2cd/winstone-project-02-brochure.pdf"],
  ["kanan hill", "b4bbe8aa-f4db-48ba-a750-5f58464f4f5f/winstone-project-03-brochure.pdf"],
  ["winstone park shouthern", "db96b5ba-343f-4d99-b409-47f1fca80b42/winstone-project-04-brochure.pdf"],
  ["winstone park southern", "db96b5ba-343f-4d99-b409-47f1fca80b42/winstone-project-04-brochure.pdf"],
  ["dokhonaloy", "bdee2670-7c6c-4bc1-947a-8bebdc006db0/winstone-project-05-brochure.pdf"],
  ["winstone lake view height", "35a696b7-3624-40d8-a086-f7c870d1597b/winstone-project-06-brochure.pdf"],
  ["metro plaza", "066f7d27-00cf-418e-9319-5e4f72ed7664/winstone-project-07-brochure.pdf"],
  ["winstone metro view park", "d2f57699-3a39-43d4-a609-f201cd10ec43/winstone-project-08-brochure.pdf"],
  ["winstone 1", "547beb86-7886-4395-9998-949c5cbaef0d/winstone-project-09-brochure.pdf"],
  ["winstone 2", "40627881-4145-41c1-913d-f4a612d61a50/winstone-project-10-brochure.pdf"],
  ["winstone 3", "16aa1b95-d2e4-4e41-9a9e-f417cbbaf2b5/winstone-project-11-brochure.pdf"],
  ["winstone 4", "ced15d3c-ee3b-45dc-a943-5834f0531cf5/winstone-project-12-brochure.pdf"],
  ["winstone 5", "96e5e4e0-0119-487f-a873-62dbd4603c0a/winstone-project-13-brochure.pdf"],
  ["winstone green view park", "34610783-a43e-40c0-abb7-ce4f64dc9373/winstone-project-14-brochure.pdf"],
  ["winstone park stone", "d22ca3bb-c3cc-4f2d-b004-1447926198dd/winstone-project-15-brochure.pdf"],
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function brochureFor(name: string): { url: string; filename: string } | null {
  const n = norm(name);
  // exact match first (so "Winstone 1" never matches "Winstone 10"-style names), then prefix match
  const hit = LIST.find(([k]) => n === k) ?? LIST.find(([k]) => !/\d$/.test(k) && n.startsWith(k));
  if (!hit) return null;
  return { url: B + hit[1], filename: `${name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-")}-Brochure.pdf` };
}
