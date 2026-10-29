import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync("src/routes/index.tsx", "utf8");
const previous = src.slice(src.indexOf("Previous version · Preview"), src.indexOf("Continue with previous version"));

describe("Get started version popup", () => {
  it("previous version states no new phone-upgrade payment", () => {
    expect(previous).toContain("No new phone-upgrade payment required.");
  });
  it("previous version shows pre-midnight release record 2.13", () => {
    expect(previous).toContain("Pre-midnight release record: 2.13");
  });
});
