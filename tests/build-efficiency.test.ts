import { describe, expect, it } from "vitest";
import { buildEfficiency, runDurationMin } from "@/lib/build-efficiency";

const run = (id: number, status: string, conclusion: string | null, min: number) => ({ id, status, conclusion, startedAt: "2026-10-30T10:00:00Z", updatedAt: new Date(Date.parse("2026-10-30T10:00:00Z") + min * 60000).toISOString() });

describe("build efficiency", () => {
  it("running builds have no duration and are not counted", () => {
    expect(runDurationMin(run(1, "in_progress", null, 5))).toBeNull();
    expect(buildEfficiency([run(1, "in_progress", null, 5)]).completed).toBe(0);
  });
  it("computes success rate and average over completed runs only", () => {
    const s = buildEfficiency([run(1, "completed", "success", 10), run(2, "completed", "failure", 20), run(3, "queued", null, 1)]);
    expect(s).toMatchObject({ completed: 2, succeeded: 1, successRate: 50, avgMinutes: 15, fastestMinutes: 10, slowestMinutes: 20 });
  });
});
