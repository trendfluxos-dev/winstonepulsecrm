import { beforeEach, describe, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ allowed: true, reads: 0 }));
const APPROVED = "approved_report_workbook_123456";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async () => ({}), requireDispatch: () => { if (!s.allowed) throw new Error("Dispatch required"); } }));
vi.mock("@/lib/report-sheet.server", () => ({ reportSheetUrl: () => "https://docs.google.com/spreadsheets/d/approved_report_workbook_123456/edit" }));
vi.mock("@/lib/lead-report-sheet.server", () => ({ leadReportSheetUrl: () => "https://docs.google.com/spreadsheets/d/approved_daily_workbook_123456" }));
vi.mock("@/lib/sheet-metrics.server", () => ({ recordSheetSyncEvent: async () => {} }));
vi.mock("@/lib/csv-leads", () => ({ toLeadRows: (grid: string[][]) => grid }));
import { parseSheetId, readSheetLeads } from "@/lib/lead-sheet.server";
import { previewSheetLeads } from "@/lib/lead-sheet.functions";
beforeEach(() => {
  s.allowed = true; s.reads = 0;
  vi.stubEnv("LOVABLE_API_KEY", "synthetic-gateway-key"); vi.stubEnv("GOOGLE_SHEETS_API_KEY", "synthetic-connection-key");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    s.reads++;
    return new Response(JSON.stringify(url.includes("/values/") ? { values: [["Name", "Phone"], ["Sample", "01700000000"]] } : { sheets: [{ properties: { title: "Leads" } }] }), { status: 200 });
  }));
});
describe("lead-sheet preview uses approved server sources only", () => {
  for (const input of [APPROVED, `https://docs.google.com/spreadsheets/d/${APPROVED}/edit`]) {
    it(`reads approved source ${input}`, async () => {
      const result = await readSheetLeads(input, "Leads");
      expect(result.sheetId).toBe(APPROVED); expect(result.rows).toEqual([["Name", "Phone"], ["Sample", "01700000000"]]);
      expect(s.reads).toBeGreaterThan(0);
    });
  }
  it("rejects a valid but unapproved ID before any connector request", async () => {
    await expect(readSheetLeads("unapproved_workbook_1234567890")).rejects.toThrow("অনুমোদিত নয়"); expect(s.reads).toBe(0);
  });
  for (const url of ["https://evil.invalid/spreadsheets/d/approved_report_workbook_123456", "https://docs.google.com.evil.invalid/spreadsheets/d/approved_report_workbook_123456", "http://docs.google.com/spreadsheets/d/approved_report_workbook_123456", "https://evil.invalid/?next=/spreadsheets/d/approved_report_workbook_123456"]) {
    it(`rejects non-Google URL ${url}`, () => { expect(() => parseSheetId(url)).toThrow(); expect(s.reads).toBe(0); });
  }
  it("enforces caller authority before reading even an approved sheet", async () => {
    s.allowed = false;
    await expect((previewSheetLeads as unknown as (args: { data: unknown }) => Promise<unknown>)({ data: { sheetUrl: APPROVED } })).rejects.toThrow("Dispatch required"); expect(s.reads).toBe(0);
  });
  it("does not silently substitute a tab when the requested tab is absent", async () => {
    await expect(readSheetLeads(APPROVED, "Missing")).rejects.toThrow("ট্যাবটি");
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/values/"))).toBe(false);
  });
});