import { afterEach, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => vi.fn());
const testConnection = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-gate.server", () => ({ requireAdminToken: guard }));
vi.mock("@/lib/meta-connection-test.server", () => ({ testMetaConnection: testConnection }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: (validate: (input: unknown) => unknown) => ({ handler: (handler: (input: { data: unknown }) => unknown) => (data: unknown) => handler({ data: validate(data) }) }) }) }));
import { inspectMetaConnection } from "@/lib/meta-connection-test.functions";
const invoke = inspectMetaConnection as unknown as (data: unknown) => Promise<unknown>;
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("rejects unauthorized callers before any provider inspection", async () => {
  guard.mockImplementationOnce(() => { throw new Error("Admin PIN required"); });
  await expect(invoke({ adminToken: null })).rejects.toThrow("Admin PIN required");
  expect(testConnection).not.toHaveBeenCalled();
});
it("forbids caller-supplied credentials or write operations", () => {
  expect(() => invoke({ adminToken: null, pageToken: "synthetic" })).toThrow();
  expect(() => invoke({ adminToken: null, operation: "subscribe" })).toThrow();
  expect(guard).not.toHaveBeenCalled();
});