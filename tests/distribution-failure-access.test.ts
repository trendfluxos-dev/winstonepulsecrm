import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ allowed: false, reads: 0 }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { inputValidator: () => b, handler: (fn: unknown) => fn }; return b; } }));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async () => ({}), requireAuthority: () => { if (!m.allowed) throw new Error("Master PIN required"); } }));
vi.mock("@/lib/distribution-failure.server", () => ({ readDistributionFailures: async () => { m.reads++; return []; } }));
import { listDistributionFailures } from "@/lib/distribution-failure.functions";
const invoke = () => (listDistributionFailures as unknown as (arg: { data: object }) => Promise<unknown>)({ data: {} });
beforeEach(() => { m.allowed = false; m.reads = 0; });
describe("admin failure history", () => {
  it("denies non-authority before reading history", async () => { await expect(invoke()).rejects.toThrow("Master PIN"); expect(m.reads).toBe(0); });
  it("existing authority can read, without assigning leads", async () => { m.allowed = true; expect(await invoke()).toEqual([]); expect(m.reads).toBe(1); });
});