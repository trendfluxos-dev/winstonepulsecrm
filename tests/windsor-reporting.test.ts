import { describe, expect, it, vi, afterEach } from "vitest";
import { WindsorReportRequest, WINDSOR_REPORT_FIELDS, canInspectWindsorConfiguration, disconnectedWindsorReport } from "@/lib/windsor-reporting";
const request = { from: "2026-10-01", to: "2026-10-31", timezone: "Asia/Dhaka", fields: [...WINDSOR_REPORT_FIELDS] };
afterEach(() => vi.unstubAllGlobals());
describe("Windsor read-only preparation", () => {
  it("accepts exactly 31 inclusive days", () => expect(WindsorReportRequest.parse(request).to).toBe("2026-10-31"));
  it("refuses 32 days", () => expect(WindsorReportRequest.safeParse({ ...request, to: "2026-11-01" }).success).toBe(false));
  it("accepts one day", () => expect(WindsorReportRequest.safeParse({ ...request, to: request.from }).success).toBe(true));
  it("refuses reversed dates", () => expect(WindsorReportRequest.safeParse({ ...request, from: "2026-11-01" }).success).toBe(false));
  it("refuses nonexistent calendar dates", () => expect(WindsorReportRequest.safeParse({ ...request, from: "2026-02-30" }).success).toBe(false));
  it("requires the explicit reporting timezone", () => expect(WindsorReportRequest.safeParse({ ...request, timezone: "UTC" }).success).toBe(false));
  it("rejects non-report fields", () => expect(WindsorReportRequest.safeParse({ ...request, fields: ["budget"] }).success).toBe(false));
  it("rejects client endpoint/account injection", () => expect(WindsorReportRequest.safeParse({ ...request, endpoint: "https://example.org", accountId: "other" }).success).toBe(false));
  it("rejects duplicate fields", () => expect(WindsorReportRequest.safeParse({ ...request, fields: ["date", "date"] }).success).toBe(false));
  it("only existing full IT scope may inspect config", () => {
    expect(canInspectWindsorConfiguration("full")).toBe(true);
    for (const scope of [null, "hq", "leadhub", "agent", "authority"]) expect(canInspectWindsorConfiguration(scope)).toBe(false);
  });
  it.each([false, true])("remains disconnected when configured=%s without network", (configured) => {
    const fetch = vi.fn(() => { throw new Error("Network forbidden"); }); vi.stubGlobal("fetch", fetch);
    expect(disconnectedWindsorReport(configured)).toEqual({ connected: false, configured, reason: configured ? "API_CONTRACT_UNVERIFIED" : "NOT_CONFIGURED", rows: [], fetchedAt: null, accountVerified: false, providerTimezoneVerified: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});