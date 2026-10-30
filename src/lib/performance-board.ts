/**
 * Browser-safe view helpers for the Daily Sales Performance board.
 * Scores come from the server (operationalScore); these helpers only sum,
 * sort and explain already-scored rows — never a second scoring engine.
 */
import { operationalScore } from "@/lib/performance-audit";

export type BoardRow = {
  agentId: string; name: string; score: number; rank: number;
  completed: number; reports: number; called: number; connected: number; followUps: number;
};

export type SortKey = "score" | "completed" | "reports" | "called" | "connected" | "followUps";

/** Floor KPIs from the rows the server returned. Highest score is null when nobody scored. */
export function summarizeBoard(rows: BoardRow[]) {
  const sum = (k: keyof Pick<BoardRow, "completed" | "reports" | "called" | "connected" | "followUps">) => rows.reduce((a, r) => a + r[k], 0);
  const top = rows.reduce((m, r) => Math.max(m, r.score), 0);
  return {
    agents: rows.length,
    completed: sum("completed"), reports: sum("reports"), called: sum("called"),
    connected: sum("connected"), followUps: sum("followUps"),
    highestScore: top > 0 ? top : null,
  };
}

/** Descending by the chosen column; ties keep the server's official rank order. */
export function sortBoard(rows: BoardRow[], key: SortKey): BoardRow[] {
  return [...rows].sort((a, b) => b[key] - a[key] || a.rank - b.rank);
}

export const POINT_WEIGHTS = [
  { key: "completed", en: "Completed assigned leads", bn: "সম্পন্ন অ্যাসাইন লিড", weight: 2 },
  { key: "reports", en: "Submitted reports", bn: "জমা দেওয়া রিপোর্ট", weight: 2 },
  { key: "called", en: "Call attempts", bn: "কলের চেষ্টা", weight: 1 },
  { key: "connected", en: "Verified connected calls", bn: "যাচাইকৃত সংযুক্ত কল", weight: 4 },
  { key: "followUps", en: "Completed follow-ups", bn: "সম্পন্ন ফলো-আপ", weight: 1.5 },
] as const;

/** Per-line explanation; total equals operationalScore for the same counts. */
export function explainPoints(r: BoardRow) {
  const lines = POINT_WEIGHTS.map((w) => ({ ...w, count: r[w.key], points: r[w.key] * w.weight }));
  const total = operationalScore({ completed: r.completed, reports: r.reports, calls: r.called, connected: r.connected, followUps: r.followUps });
  return { lines, total };
}
