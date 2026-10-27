import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: (v: (i: unknown) => unknown) => ({ handler: (fn: (a: { data: unknown }) => unknown) => (i: unknown) => fn({ data: v(i) }) }) }) }));
vi.mock("@/lib/access.server", () => ({
  resolveCaller: async () => ({ scope: "agent", profile: { id: "a" } }),
  requireAuthority: (c: { scope: string }) => { if (c.scope !== "authority") throw new Error("HQ access required"); },
}));
import { getLeadPoolNotice } from "@/lib/lead-pool-notice.functions";
describe("HQ lead pool notice", () => {
  it("refuses a non-HQ caller", async () => {
    await expect((getLeadPoolNotice as unknown as (i: unknown) => Promise<unknown>)({ adminToken: null })).rejects.toThrow("HQ access required");
  });
});
