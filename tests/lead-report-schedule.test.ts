import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sync: vi.fn(), audit: vi.fn() }));
vi.mock("@/integrations/supabase/cron-auth", () => ({ authenticateCronRequest: mocks.auth }));
vi.mock("@/lib/lead-report-sheet.server", () => ({ syncLeadReportToSheet: mocks.sync }));
vi.mock("@/lib/audit.server", () => ({ logAudit: mocks.audit }));
import { handleLeadReportSchedule, LEAD_REPORT_SCHEDULE } from "@/lib/lead-report-schedule.server";

const request = (body: unknown = { kind: "daily" }) => new Request("https://example.test/api/public/jobs/lead-report-sheet", {
  method: "POST", body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.audit.mockResolvedValue(undefined);
});

describe("scheduled Daily Lead Report", () => {
  it("runs daily at 17:30 Dhaka", () => {
    expect(LEAD_REPORT_SCHEDULE.schedule).toBe("30 11 * * *");
    expect(LEAD_REPORT_SCHEDULE.body).toEqual({ kind: "daily" });
  });
  it("rejects unauthenticated requests without exporting leads", async () => {
    mocks.auth.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    expect((await handleLeadReportSchedule(request())).status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("rejects an invalid job body before accessing the sheet", async () => {
    expect((await handleLeadReportSchedule(request({ kind: "other" }))).status).toBe(400);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("syncs with preservation and returns safe counts only", async () => {
    mocks.sync.mockResolvedValue({ tab: "2026-10-25", rows: 2, syncedAt: "2026-10-25T11:35:00Z", sheetUrl: "private" });
    const response = await handleLeadReportSchedule(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, tab: "2026-10-25", rows: 2, syncedAt: "2026-10-25T11:35:00Z" });
    expect(mocks.sync).toHaveBeenCalledWith({ preserveExisting: true });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ outcome: "success" }) }));
  });
  it("reports and audits failure without returning provider content", async () => {
    mocks.sync.mockRejectedValue(new Error("sensitive provider content"));
    const response = await handleLeadReportSchedule(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, code: "SHEET_SYNC_FAILED" });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ outcome: "failure" }) }));
  });
});
import { nextLeadReportRun } from "@/lib/lead-report-next";
describe("next Daily Lead Report time", () => {
  it("is today 17:30 Dhaka before it, tomorrow after it", () => {
    expect(nextLeadReportRun(new Date("2026-10-25T05:00:00Z")).toISOString()).toBe("2026-10-25T11:30:00.000Z");
    expect(nextLeadReportRun(new Date("2026-10-25T11:31:00Z")).toISOString()).toBe("2026-10-26T11:30:00.000Z");
  });
});
