import { afterEach, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-gate.server", () => ({ requireAdminToken: guard }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: (validate: (input: unknown) => unknown) => ({ handler: (handler: (input: { data: unknown }) => unknown) => (data: unknown) => handler({ data: validate(data) }) }) }) }));
import { inspectMetaCredentialSafety } from "@/lib/meta-connection-test.functions";
const invoke = inspectMetaCredentialSafety as unknown as (input: unknown) => Promise<Record<string, unknown>>;
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("requires full IT authorization before inspecting storage", async () => {
  guard.mockImplementationOnce(() => { throw new Error("Admin PIN required"); });
  await expect(invoke({ adminToken: null })).rejects.toThrow("Admin PIN required");
});
it("does not accept replacement credentials through app requests", () => {
  expect(() => invoke({ adminToken: null, pageToken: "synthetic-replacement" })).toThrow();
  expect(guard).not.toHaveBeenCalled();
});
it("returns presence only, never rotation, revocation or production proof", async () => {
  vi.stubEnv("META_PAGE_ACCESS_TOKEN", "synthetic-only");
  const transport = vi.fn(); vi.stubGlobal("fetch", transport);
  const result = await invoke({ adminToken: null });
  expect(result).toEqual({ checkedAt: expect.any(String), configured: true, credentialSource: "managed_server_secret", oldTokenRevocation: "unverified", productionReplacement: "unverified", connected: false });
  expect(transport).not.toHaveBeenCalled();
});
it("reads current managed configuration on every attempt, with no old-token fallback", async () => {
  vi.stubEnv("META_PAGE_ACCESS_TOKEN", "synthetic-only");
  expect((await invoke({ adminToken: null })).configured).toBe(true);
  vi.stubEnv("META_PAGE_ACCESS_TOKEN", "");
  expect((await invoke({ adminToken: null })).configured).toBe(false);
});