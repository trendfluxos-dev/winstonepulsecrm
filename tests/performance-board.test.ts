import { describe, expect, it } from "vitest";
import { explainPoints, sortBoard, summarizeBoard, type BoardRow } from "@/lib/performance-board";
import { operationalScore } from "@/lib/performance-audit";
import { rankPerformers, topPerformerDate } from "@/lib/top-performer.server";

const row = (id: string, p: Partial<BoardRow> = {}): BoardRow => ({ agentId: id, name: id, score: 0, rank: 1, completed: 0, reports: 0, called: 0, connected: 0, followUps: 0, ...p });
const one = (k: "completed" | "reports" | "calls" | "connected" | "followUps") => operationalScore({ completed: 0, reports: 0, calls: 0, connected: 0, followUps: 0, [k]: 1 });

describe("daily sales performance scoring", () => {
  it("applies each multiplier exactly", () => {
    expect(one("completed")).toBe(2);
    expect(one("reports")).toBe(2);
    expect(one("calls")).toBe(1);
    expect(one("connected")).toBe(4);
    expect(one("followUps")).toBe(1.5);
  });
  it("explains points with the same total as the server score", () => {
    const r = row("a", { completed: 3, reports: 4, called: 10, connected: 2, followUps: 2 });
    const e = explainPoints(r);
    expect(e.total).toBe(3 * 2 + 4 * 2 + 10 + 2 * 4 + 2 * 1.5);
    expect(e.lines.reduce((a, l) => a + l.points, 0)).toBe(e.total);
  });
  it("zero activity gives no highest score", () => {
    expect(summarizeBoard([row("a"), row("b")]).highestScore).toBeNull();
    expect(summarizeBoard([]).agents).toBe(0);
  });
  it("sums floor KPIs from the rows only", () => {
    const s = summarizeBoard([row("a", { score: 9, called: 3, connected: 1 }), row("b", { score: 4, called: 2 })]);
    expect(s).toMatchObject({ agents: 2, called: 5, connected: 1, highestScore: 9 });
  });
  it("column sort keeps official rank on ties", () => {
    const rows = [row("x", { rank: 2, called: 5 }), row("y", { rank: 1, called: 5 }), row("z", { rank: 3, called: 9 })];
    expect(sortBoard(rows, "called").map((r) => r.agentId)).toEqual(["z", "y", "x"]);
  });
  it("ranking ties break deterministically by agent id", () => {
    const base = { name: "", photoUrl: null, called: 1, connected: 0, reports: 0, followUps: 0, talkMinutes: 0, connectRate: 0, score: 5, quota: 50, targetQuota: 50, assigned: 0, completed: 0, completionPercent: 0, fairScore: 0 };
    expect(rankPerformers([{ ...base, agentId: "b" }, { ...base, agentId: "a" }]).map((l) => l.agentId)).toEqual(["a", "b"]);
  });
  it("uses Dhaka day boundaries: 23:59 UTC Oct 29 is Oct 30 in Dhaka", () => {
    expect(topPerformerDate(new Date("2026-10-29T17:59:00Z")).dateKey).toBe("2026-10-29");
    expect(topPerformerDate(new Date("2026-10-29T18:01:00Z")).dateKey).toBe("2026-10-30");
  });
  it("reveals at exactly 5:30 PM Dhaka", () => {
    expect(topPerformerDate(new Date("2026-10-29T11:29:00Z")).revealed).toBe(false);
    expect(topPerformerDate(new Date("2026-10-29T11:30:00Z")).revealed).toBe(true);
  });
});
