import { describe, expect, it } from "vitest";
import { auditCsvCell, buildAuditCsv } from "@/lib/audit-export";

describe("audit CSV treats caller-controlled cells as text", () => {
  for (const value of ["=HYPERLINK(\"https://example.invalid\")", "+SUM(1,2)", "-1+2", "@SUM(1,2)", "  =1+1", "\t=1+1", "\r@SUM(1,2)", "\u0000=1+1"]) {
    it(`neutralises ${JSON.stringify(value)}`, () => {
      expect(auditCsvCell(value)).toBe(`"'${value.replace(/"/g, '""')}"`);
    });
  }
  it("preserves ordinary Bangla names and escapes quotes, commas and line breaks", () => {
    expect(auditCsvCell('মেহেদী, "Staff"\nNote')).toBe('"মেহেদী, ""Staff""\nNote"');
    expect(auditCsvCell(null)).toBe('""');
  });
  it("neutralises every column in a complete exported row", () => {
    expect(buildAuditCsv([["Who", "Changes"], ["=1+1", " @SUM(1,2)"]]))
      .toBe('"Who","Changes"\r\n"\'=1+1","\' @SUM(1,2)"');
  });
});