import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ caller: vi.fn(), configure: vi.fn(), refresh: vi.fn(), read: vi.fn(), audit: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }) }));
vi.mock("@/lib/sales-intel.server", () => ({ siCaller: mocks.caller, requireAdminWriter: (c: { scope: string; readOnly: boolean }) => { if (c.scope !== "authority" || c.readOnly) throw new Error("Forbidden"); } }));
vi.mock("@/lib/inventory-sheet.server", () => ({ readInventorySheetState: mocks.read, configureInventorySheet: mocks.configure, syncInventorySheet: mocks.refresh }));
vi.mock("@/lib/audit.server", () => ({ logAudit: mocks.audit }));
import { inventorySheetStatus, refreshInventorySheet, saveInventorySheetSource } from "../src/lib/inventory-sheet.functions";
const invoke = (fn: unknown, data = {}) => (fn as (arg: { data: unknown }) => Promise<unknown>)({ data });
beforeEach(() => { vi.clearAllMocks(); });
describe("inventory sheet authority boundaries", () => {
  it("refuses signed-out reads before querying saved inventory", async () => {
    mocks.caller.mockRejectedValue(new Error("Sign in"));
    await expect(invoke(inventorySheetStatus)).rejects.toThrow();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([{ scope: "agent", readOnly: false }, { scope: "authority", readOnly: true }])("refuses configuration and refresh for %o", async (caller) => {
    mocks.caller.mockResolvedValue(caller);
    await expect(invoke(saveInventorySheetSource)).rejects.toThrow("Forbidden");
    await expect(invoke(refreshInventorySheet)).rejects.toThrow("Forbidden");
    expect(mocks.configure).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("staff status reads saved snapshot without provider refresh", async () => {
    mocks.caller.mockResolvedValue({ scope: "agent", readOnly: false }); mocks.read.mockResolvedValue(null);
    expect(await invoke(inventorySheetStatus)).toEqual({ state: null, canManage: false });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});