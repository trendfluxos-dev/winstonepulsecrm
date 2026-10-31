import { describe, expect, it } from "vitest";
import { buildChannel, formatBuildStamp } from "@/lib/build-info";

describe("build indicator", () => {
  it("marks the custom domain and published URL as live", () => {
    expect(buildChannel("crm.winstonebd.com")).toBe("live");
    expect(buildChannel("winstonepulsecrm.lovable.app")).toBe("live");
  });
  it("marks preview and localhost as preview", () => {
    expect(buildChannel("id-preview--990267f3-4198-4d83-ae21-7d9c802617f4.lovable.app")).toBe("preview");
    expect(buildChannel("localhost")).toBe("preview");
  });
  it("formats the build time in Dhaka", () => {
    expect(formatBuildStamp("2026-10-31T13:05:00.000Z")).toBe("31 Oct 19:05");
    expect(formatBuildStamp(null)).toBe("—");
  });
});
