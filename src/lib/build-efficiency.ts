/** Pure build-efficiency rules. Duration only for completed runs; finish = GitHub's last update of a completed run. */
export type BuildRunLike = { id: number; status: string; conclusion: string | null; startedAt: string; updatedAt: string };

export function runDurationMin(r: BuildRunLike): number | null {
  if (r.status !== "completed") return null;
  const ms = Date.parse(r.updatedAt) - Date.parse(r.startedAt);
  return Number.isFinite(ms) && ms >= 0 ? Math.round((ms / 60000) * 10) / 10 : null;
}

export function buildEfficiency(runs: BuildRunLike[]) {
  const done = runs.filter((r) => r.status === "completed");
  const ok = done.filter((r) => r.conclusion === "success");
  const durations = done.map(runDurationMin).filter((d): d is number => d !== null);
  const avg = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;
  return {
    completed: done.length,
    succeeded: ok.length,
    successRate: done.length ? Math.round((ok.length / done.length) * 100) : null,
    avgMinutes: avg,
    fastestMinutes: durations.length ? Math.min(...durations) : null,
    slowestMinutes: durations.length ? Math.max(...durations) : null,
  };
}
