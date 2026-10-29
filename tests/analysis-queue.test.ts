import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], error: null as object | null, filter: "", analyzed: 0 }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => {
    const query: Record<string, (...args: any[]) => any> = {};
    for (const method of ["select", "lt", "order", "eq"]) query[method] = () => query;
    query.or = (filter: string) => { state.filter = filter; return query; };
    query.limit = async () => ({ data: state.rows, error: state.error });
    query.maybeSingle = async () => ({ data: state.rows[0], error: null });
    return query;
  },
} }));
vi.mock("@/lib/call-intel.server", () => ({ processRecording: async () => { state.analyzed++; return "done"; } }));
vi.mock("@/lib/lead-events.server", () => ({ logLeadEvent: async () => {} }));
vi.mock("@/lib/call-jobs.server", () => ({ upsertCallJob: async () => {} }));
import { analyzePending } from "@/lib/analysis-queue.server";
beforeEach(() => { state.rows = []; state.error = null; state.filter = ""; state.analyzed = 0; vi.useRealTimers(); });
describe("automatic recording summary recovery", () => {
  it("selects interrupted processing only older than the 15-minute lease", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T02:45:00Z"));
    await analyzePending();
    expect(state.filter).toBe("analysis_status.in.(pending,failed),and(analysis_status.eq.processing,updated_at.lt.2026-10-29T02:30:00.000Z)");
    vi.useRealTimers();
  });
  it("read failure is not a successful empty sweep", async () => {
    state.error = { message: "synthetic db failure" };
    await expect(analyzePending()).rejects.toThrow("queue could not be read");
    expect(state.analyzed).toBe(0);
  });
  it("completed recordings do not spend AI credits again", async () => {
    state.rows = [{ id: "saved-audio", analysis_status: "completed" }];
    expect(await analyzePending()).toEqual([{ id: "saved-audio", status: "completed" }]);
    expect(state.analyzed).toBe(0);
  });
  it("active processing lease is never duplicated", async () => {
    state.rows = [{ id: "active-audio", analysis_status: "processing", updated_at: new Date().toISOString() }];
    expect(await analyzePending()).toEqual([{ id: "active-audio", status: "processing" }]);
    expect(state.analyzed).toBe(0);
  });
});