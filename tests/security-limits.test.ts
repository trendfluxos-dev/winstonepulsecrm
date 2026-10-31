import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { safeCell } from "@/lib/report-sheet.server";

const read = (p: string) => readFileSync(p, "utf8");

// Owner decisions 2026-10-27: shift-summary cells neutralised, help centre shows
// only used categories, project photo links last 1 minute, recording links 30 seconds.
describe("security limits decided 2026-10-27", () => {
  it("neutralises formula-leading text before it reaches a spreadsheet", () => {
    expect(safeCell("=HYPERLINK(\"http://x\",\"click\")")).toBe("'=HYPERLINK(\"http://x\",\"click\")");
    expect(safeCell("@cmd")).toBe("'@cmd");
    expect(safeCell("+1 555")).toBe("'+1 555");
    expect(safeCell("Rahim")).toBe("Rahim");
    expect(safeCell(null)).toBe("");
  });

  it("shift summary writes every cell through the guard", () => {
    const src = read("src/lib/shift-sheet.server.ts");
    expect(src).toMatch(/import \{ safeCell \} from "@\/lib\/report-sheet\.server"/);
    expect(src).toMatch(/rows\.map\(\(r\) => r\.map\(safeCell\)\)/);
  });

  it("project photo links last one minute", () => {
    const src = read("src/lib/projects.functions.ts");
    const m = src.match(/createSignedUrl\(path, (\d+)\)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(60);
  });

  it("call recording playback issues no signed link (ownership re-checked per request)", () => {
    const src = read("src/lib/crm.functions.ts");
    expect(src).not.toMatch(/createSignedUrl\(recording\.audio_url/);
    expect(src).toMatch(/\.from\("call-audio"\)\s*\.download\(recording\.audio_url\)/);
  });

  it("help centre lists only categories that have a published article", () => {
    const src = read("src/lib/support.functions.ts");
    expect(src).toMatch(/const used = new Set\(\(articles \?\? \[\]\)\.map\(\(a\) => a\.category_id\)\.filter\(Boolean\)\)/);
    expect(src).toMatch(/categories: \(categories \?\? \[\]\)\.filter\(\(c\) => used\.has\(c\.id\)\)/);
  });
});
