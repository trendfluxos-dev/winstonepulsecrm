import { describe, expect, it } from "vitest";
import { evaluateFirebase, rangeAllowsFixed, shouldAlert } from "@/lib/firebase-grpc-watch";

describe("firebase grpc-js watch", () => {
  it("today's ~1.9.0 pin cannot reach the fixed 1.13.6", () => {
    expect(rangeAllowsFixed("~1.9.0")).toBe(false);
    expect(rangeAllowsFixed("^1.9.0")).toBe(true);
    expect(rangeAllowsFixed("~1.13.6")).toBe(true);
    expect(rangeAllowsFixed("1.13.5")).toBe(false);
    expect(rangeAllowsFixed("1.13.6")).toBe(true);
    expect(rangeAllowsFixed("~1.13.0")).toBe(true);
    expect(rangeAllowsFixed("~1.12.9")).toBe(false);
  });

  it("unknown range formats are never reported as fixed", () => {
    expect(rangeAllowsFixed("1.9.x")).toBeNull();
    expect(rangeAllowsFixed("~1.9.0 || ~1.13.6")).toBeNull();
  });

  it("current Firebase 13.1.0 manifest is not fixed and raises no alert", () => {
    const v = evaluateFirebase({ version: "13.1.0" }, { version: "4.17.2", dependencies: { "@grpc/grpc-js": "~1.9.0" } });
    expect(v.fixed).toBe(false);
    expect(shouldAlert(v, null)).toBe(false);
  });

  it("alerts once when a release allows the fix, not again on later days", () => {
    const v = evaluateFirebase({ version: "13.2.0" }, { version: "4.18.0", dependencies: { "@grpc/grpc-js": "~1.14.0" } });
    expect(v.fixed).toBe(true);
    expect(shouldAlert(v, null)).toBe(true);
    expect(shouldAlert(v, { alertedFor: "13.2.0" })).toBe(false);
  });
});
