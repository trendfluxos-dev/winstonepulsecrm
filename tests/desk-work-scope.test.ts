import { describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ caller: { scope: "authority", profile: null } as { scope: string; profile: { id: string } | null } }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ handler: (fn: () => unknown) => fn }) }));
vi.mock("@/lib/access.server", () => ({ resolveWorkCaller: async () => m.caller }));
import { getDeskWork } from "@/lib/desk-work.functions";
const run = getDeskWork as unknown as () => Promise<unknown>;
describe("desk work counts are agent-only", () => {
  it("refuses an HQ/IT authority caller", async () => {
    m.caller = { scope: "authority", profile: null };
    await expect(run()).rejects.toThrow("Agent access required");
  });
  it("refuses a caller with no signed-in session", async () => {
    m.caller = { scope: "none", profile: null };
    await expect(run()).rejects.toThrow("Agent access required");
  });
});
