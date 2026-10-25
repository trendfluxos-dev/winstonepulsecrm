import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ saved: [] as Record<string, unknown>[], error: false }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ insert: async (row: Record<string, unknown>) => { m.saved.push(row); return { error: m.error ? {} : null }; } }) } }));
import { recordDistributionFailure } from "@/lib/distribution-failure.server";
beforeEach(() => { m.saved = []; m.error = false; });
describe("failure alert persistence", () => {
  it("stores reason and stage, never raw errors or credentials", async () => {
    await recordDistributionFailure(new Error("statement timeout secret=synthetic-private"), "assign");
    expect(m.saved[0]).toMatchObject({ code: "lead_distribution_failed", severity: "critical", detail: '{"reason":"timeout","stage":"assign"}' });
    expect(JSON.stringify(m.saved)).not.toContain("synthetic-private");
  });
  it("fails if the alert was not persisted rather than claiming delivery", async () => {
    m.error = true; await expect(recordDistributionFailure(new Error("timeout"), "pool")).rejects.toThrow("could not be saved");
  });
});