import { afterEach, describe, expect, it, vi } from "vitest";
const scope = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-gate.server", () => ({ adminTokenScope: scope }));
// Execute only the handler in isolation; no RPC runtime or production callers.
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({
  inputValidator: (validate: (input: unknown) => unknown) => ({
    handler: (handler: (input: { data: unknown }) => unknown) => (data: unknown) => handler({ data: validate(data) }),
  }),
}) }));
import { inspectWindsorReport } from "@/lib/windsor-reporting.functions";
const input = { adminToken: null, report: { from: "2026-10-01", to: "2026-10-02", timezone: "Asia/Dhaka", fields: ["date"] } };
const invoke = inspectWindsorReport as unknown as (input: unknown) => Promise<{ connected: boolean; configured: boolean; rows: unknown[] }>;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("isolated Windsor server boundary", () => {
  it.each([null, "hq", "leadhub"])("rejects %s scope before configuration read", async (value) => {
    scope.mockReturnValue(value);
    await expect(invoke(input)).rejects.toThrow("Full IT PIN required");
  });
  it.each([false, true])("never contacts provider or DB when configured=%s", async (configured) => {
    scope.mockReturnValue("full");
    vi.stubEnv("WINDSOR_AI_API_KEY", configured ? "synthetic-test-only" : "");
    const fetch = vi.fn(() => { throw new Error("All network calls forbidden"); }); vi.stubGlobal("fetch", fetch);
    const result = await invoke(input);
    expect(result).toMatchObject({ connected: false, configured, rows: [], fetchedAt: null });
    expect(Object.keys(result).sort()).toEqual(["accountVerified", "configured", "connected", "fetchedAt", "providerTimezoneVerified", "reason", "rows"]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects unknown operations before entering handler", () => {
    expect(() => invoke({ ...input, operation: "update_budget" })).toThrow();
    expect(scope).not.toHaveBeenCalled();
  });
});