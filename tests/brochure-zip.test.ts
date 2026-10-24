/**
 * The "download all brochures as one ZIP" rule: the bundle must carry exactly the
 * 15 official project brochures, each once, with a unique name and a same-origin
 * URL so the browser can fetch it without a cross-origin block.
 */
import { describe, expect, it } from "vitest";

import { allBrochures, brochureFor } from "@/lib/project-brochures";

describe("allBrochures", () => {
  const list = allBrochures();

  it("carries exactly 15 brochures", () => {
    expect(list).toHaveLength(15);
  });

  it("never repeats a file or an entry name", () => {
    expect(new Set(list.map((b) => b.url)).size).toBe(15);
    expect(new Set(list.map((b) => b.entry)).size).toBe(15);
  });

  it("serves every brochure from the app's own origin", () => {
    for (const b of list) {
      expect(b.url.startsWith("/__l5e/assets-v1/")).toBe(true);
      expect(b.entry).toMatch(/^\d{2}-.+-Brochure\.pdf$/);
    }
  });

  it("keeps the per-project links pointing at the same 15 files", () => {
    const urls = new Set(list.map((b) => b.url));
    for (const name of [
      "Winstone Dream Park", "Silver Sun", "Kanan Hill", "Winstone Park Southern", "Dokhonaloy",
      "Winstone Lake View Height", "Metro Plaza", "Winstone Metro View Park", "Winstone 1",
      "Winstone 2", "Winstone 3", "Winstone 4", "Winstone 5", "Winstone Green View Park", "Winstone Park Stone",
    ]) {
      const b = brochureFor(name);
      expect(b, name).not.toBeNull();
      expect(urls.has(b!.url), name).toBe(true);
    }
  });
});
