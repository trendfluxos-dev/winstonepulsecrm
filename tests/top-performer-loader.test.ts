import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the Top Performer loader (`dailyTopPerformer`).
 *
 * The home page renders this board before sign-in, so a loader failure takes
 * the whole entry page down. These tests run the real loader against a
 * mocked database so a broken query chain, a changed table shape or a
 * photo-signing failure fails here — before publish — instead of live.
 */

type Row = Record<string, unknown>;

const state = {
  profiles: [] as Row[],
  call_reports: [] as Row[],
  follow_up_events: [] as Row[],
  leads: [] as Row[],
  lead_extra_grants: [] as Row[],
  signed: [] as Row[],
  error: null as { message: string } | null,
  errorTable: null as string | null,
  filters: [] as { table: string; method: string; args: unknown[] }[],
};

/** Thenable query chain: every builder method returns itself, await resolves. */
function queryFor(table: keyof typeof state & string) {
  const chain: Record<string, unknown> = {};
  const resolve = () => ({ data: state[table as never] ?? [], error: state.errorTable === table ? { message: "read failed" } : state.error });
  for (const m of ["select", "eq", "neq", "not", "gte", "lte", "in", "limit", "order", "range"]) {
    chain[m] = (...args: unknown[]) => { state.filters.push({ table, method: m, args }); return chain; };
  }
  chain.then = (res: (v: unknown) => unknown) => Promise.resolve(res(resolve()));
  return chain;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => queryFor(table as never),
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: state.signed.filter((s) => paths.includes(s.path as string)),
        }),
      }),
    },
  },
}));

vi.mock("@/lib/lead-quota", () => ({
  quotaFor: () => 50,
  effectiveQuota: (q: number) => q,
  completionPercent: () => 0,
  ratioScore: (s: number) => s,
}));

vi.mock("@/lib/lead-pool.server", () => ({
  dailyPlan: async () => ({ perAgent: 50 }),
  extraGrantsToday: async () => ({}),
}));

import { dailyTopPerformer } from "@/lib/top-performer.server";

const agent = (id: string, name: string, photo_path: string | null = null): Row => ({
  id,
  name,
  employee_id: id.toUpperCase(),
  photo_path,
});

const report = (agent_id: string, connected: boolean, lead_id: string | null = null): Row => ({
  id: `report-${reportSequence++}`,
  agent_id,
  lead_id,
  status: "submitted",
  connected,
  duration_seconds: connected ? 120 : 0,
  created_at: "2026-10-07T06:00:00Z",
});
let reportSequence = 0;

const lead = (assigned_to: string, work_state: string): Row => ({
  id: `lead-${assigned_to}-${Math.random().toString(36).slice(2, 8)}`,
  assigned_to,
  work_state,
  work_date: "2026-10-07",
});

beforeEach(() => {
  state.profiles = [];
  state.call_reports = [];
  state.follow_up_events = [];
  state.leads = [];
  state.lead_extra_grants = [];
  state.signed = [];
  state.error = null;
  state.errorTable = null;
  state.filters = [];
});

describe("Top Performer loader (dailyTopPerformer)", () => {
  it("counts submitted reports and completed assigned work without reading audio uploads", async () => {
    state.profiles = [agent("a1", "Agent")];
    state.call_reports = [{ ...report("a1", true, "lead-1"), connection_verified: true }];
    state.leads = [
      { id: "lead-1", assigned_to: "a1", work_state: "completed" },
      { id: "lead-2", assigned_to: "a1", work_state: "completed" },
    ];
    const board = await dailyTopPerformer(new Date("2026-10-27T12:00:00Z"));
    expect(board.winner?.called).toBe(1);
    expect(board.winner?.reports).toBe(1);
    expect(board.winner?.connected).toBe(1);
    expect(board.winner?.completed).toBe(2);
    expect(state.filters.some(f => f.table === "call_recordings" || f.table === "recorder_insights")).toBe(false);
  });

  it("reads the selected previous Dhaka day, including its own allocation grants", async () => {
    state.profiles = [agent("a1", "Monisha")];
    state.call_reports = [report("a1", true)];
    const board = await dailyTopPerformer(new Date("2026-10-27T04:00:00Z"), "2026-10-26");
    expect(board.dateKey).toBe("2026-10-26");
    expect(board.revealed).toBe(true);
    expect(board.topThree[0]?.reports).toBe(1);
    expect(state.filters).toEqual(expect.arrayContaining([
      { table: "call_reports", method: "gte", args: ["submitted_at", "2026-10-25T18:00:00.000Z"] },
      { table: "call_reports", method: "lte", args: ["submitted_at", "2026-10-26T17:59:59.000Z"] },
      { table: "leads", method: "eq", args: ["work_date", "2026-10-26"] },
      { table: "lead_extra_grants", method: "eq", args: ["work_date", "2026-10-26"] },
    ]));
  });

  it("does not invent historical results for an agent with no saved evidence", async () => {
    state.profiles = [agent("a1", "Monisha")];
    const board = await dailyTopPerformer(new Date("2026-10-27T04:00:00Z"), "2026-10-26");
    expect(board.topThree).toEqual([]);
    expect(board.otherAgents).toEqual([]);
  });

  it("keeps the selected current day unrevealed until 5:30 pm", async () => {
    const board = await dailyTopPerformer(new Date("2026-10-27T11:29:00Z"), "2026-10-27");
    expect(board.revealed).toBe(false);
  });

  it("fails rather than presenting a partial historical allocation", async () => {
    state.errorTable = "leads";
    await expect(dailyTopPerformer(new Date("2026-10-27T04:00:00Z"), "2026-10-26")).rejects.toThrow("Performance allocation unavailable");
  });

  it("returns a complete board with a winner, top 3 and signed photo links", async () => {
    state.profiles = [
      agent("a1", "Monisha", "a1/1.jpg"),
      agent("a2", "Nazrin", "a2/1.jpg"),
      agent("a3", "Soniya"),
      agent("a4", "Sabbir"),
    ];
    state.call_reports = [
      ...Array.from({ length: 10 }, () => report("a1", true)),
      ...Array.from({ length: 6 }, () => report("a2", true)),
      ...Array.from({ length: 3 }, () => report("a3", true)),
      report("a4", false),
    ];
    state.signed = [
      { path: "a1/1.jpg", signedUrl: "https://signed/a1.jpg" },
      { path: "a2/1.jpg", signedUrl: "https://signed/a2.jpg" },
    ];

    const board = await dailyTopPerformer();

    expect(board.winner?.agentId).toBe("a1");
    expect(board.topThree.map((l) => l.agentId)).toEqual(["a1", "a2", "a3"]);
    expect(board.winner?.photoUrl).toBe("https://signed/a1.jpg");
    expect(board.topThree[1].photoUrl).toBe("https://signed/a2.jpg");
    expect(board.topThree[2].photoUrl).toBeNull(); // no photo uploaded
    expect(board.otherAgents.map((l) => l.agentId)).toEqual(["a4"]);
    expect(board.sources.callReportRows).toBe(20);
  });

  it("excludes desks with more than 30% pending leads from the Top 3", async () => {
    state.profiles = [agent("a1", "Monisha"), agent("a2", "Nazrin")];
    // a1 has the higher score but 40 of 50 leads still pending (80%).
    state.call_reports = [
      ...Array.from({ length: 12 }, () => report("a1", true)),
      ...Array.from({ length: 5 }, () => report("a2", true)),
    ];
    state.leads = [
      ...Array.from({ length: 50 }, (_, i) => lead("a1", i < 10 ? "completed" : "new")),
      ...Array.from({ length: 50 }, () => lead("a2", "completed")),
    ];

    const board = await dailyTopPerformer();

    expect(board.topThree.map((l) => l.agentId)).toEqual(["a2"]);
    expect(board.winner?.agentId).toBe("a2");
    // The excluded desk keeps its rank in the full list but carries the reason.
    const excluded = board.otherAgents.find((l) => l.agentId === "a1");
    expect(excluded?.gap).toContain("৩০%");
  });

  it("fails loudly when a database query errors instead of rendering a broken board", async () => {
    state.profiles = [agent("a1", "Monisha")];
    state.error = { message: "connection lost" };

    await expect(dailyTopPerformer()).rejects.toThrow("connection lost");
  });

  it("still works when photo signing returns nothing", async () => {
    state.profiles = [agent("a1", "Monisha", "a1/1.jpg")];
    state.call_reports = [report("a1", true)];
    state.signed = [];

    const board = await dailyTopPerformer();

    expect(board.winner?.agentId).toBe("a1");
    expect(board.winner?.photoUrl).toBeNull();
  });
});
