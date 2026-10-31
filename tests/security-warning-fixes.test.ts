import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectReportCsv } from "@/lib/project-reports";

describe("deep-scan warning fixes (2026-10-31)", () => {
  it("project report CSV exports formula-leading project labels as plain text", () => {
    const base = { projectId: "p", active: true, leads: 1, calls: 2, siteVisits: 0, bookings: 0 };
    const csv = projectReportCsv(["=HYPERLINK(\"x\")", "+1", "-2", "@cmd"].map((project) => ({ ...base, project })));
    const cells = csv.split(/\r?\n/).slice(1).map((line) => line.split(",")[0]);
    expect(cells).toEqual([`"'=HYPERLINK(""x"")"`, `"'+1"`, `"'-2"`, `"'@cmd"`]);
  });

  it("retired public release-preparation read no longer exists", () => {
    const src = readFileSync("src/lib/phone-upgrade.functions.ts", "utf8");
    expect(src).not.toContain("getPhoneUpgradePreparation");
    expect(src).not.toContain('from("app_releases")');
  });

  it("day-call export recording links last 2 minutes, not 15", () => {
    const src = readFileSync("src/lib/day-export.functions.ts", "utf8");
    expect(src).toMatch(/const SIGNED_URL_SECONDS = 2 \* 60;/);
  });
});
