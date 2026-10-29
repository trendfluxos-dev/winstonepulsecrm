import { describe, expect, it, vi, afterEach } from "vitest";
import { phoneUpgradeDecision, isLegacyPhoneRelease, assertPhoneUpgradeReady, PHONE_UPGRADE_PREPARATION } from "@/lib/phone-upgrade";
const identity = vi.hoisted(() => ({ architectFromRequest: vi.fn(), architectSessionValid: vi.fn() }));
vi.mock("@/lib/maintenance.server", () => identity);
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({
  inputValidator: (validate: (input: unknown) => unknown) => ({ handler: (handler: (input: { data: unknown }) => unknown) => (data: unknown) => handler({ data: validate(data) }) }),
  handler: (handler: () => unknown) => handler,
}) }));
import { approvePhoneUpgrade, requestPhoneUpgradeBill } from "@/lib/phone-upgrade.functions";
const approve = approvePhoneUpgrade as unknown as (data: unknown) => Promise<unknown>;
const request = requestPhoneUpgradeBill as unknown as (data: unknown) => Promise<unknown>;
afterEach(() => vi.clearAllMocks());
describe("phone upgrade preparation", () => {
  it("Preview does not require the new fee even while pricing is unset", () => {
    expect(phoneUpgradeDecision({ choice: "preview", amountMinor: null, activated: false })).toEqual({ allowed: true, reason: "no_new_upgrade_fee" });
  });
  it("Dhaka midnight October 29 is the exact older-version boundary", () => {
    expect(isLegacyPhoneRelease("2026-10-28T17:59:59.999Z")).toBe(true);
    expect(isLegacyPhoneRelease("2026-10-28T18:00:00.000Z")).toBe(false);
    expect(isLegacyPhoneRelease("invalid")).toBe(false);
  });
  it("unconfirmed release cannot unlock", () => {
    expect(phoneUpgradeDecision({ choice: "updated_phone", amountMinor: null, activated: false }).reason).toBe("release_unconfirmed");
  });
  it("missing price cannot be treated as free", () => {
    expect(phoneUpgradeDecision({ choice: "updated_phone", releaseId: "release", amountMinor: null, activated: true })).toEqual({ allowed: false, reason: "price_unconfirmed" });
    expect(PHONE_UPGRADE_PREPARATION.amountMinor).toBeNull();
    expect(PHONE_UPGRADE_PREPARATION.activated).toBe(false);
    expect(() => assertPhoneUpgradeReady()).toThrow("owner confirmation");
  });
  it("accepted invoice is not Architect verified payment", () => {
    expect(phoneUpgradeDecision({ choice: "updated_phone", releaseId: "r1", payerId: "p1", amountMinor: 100, activated: true, verifiedPayment: { releaseId: "r1", payerId: "p1", verifiedByArchitect: false } }).allowed).toBe(false);
  });
  it.each([{ releaseId: "r2", payerId: "p1" }, { releaseId: "r1", payerId: "p2" }])("proof never transfers between release or payer: %j", proof => {
    expect(phoneUpgradeDecision({ choice: "updated_phone", releaseId: "r1", payerId: "p1", amountMinor: 100, activated: true, verifiedPayment: { ...proof, verifiedByArchitect: true } }).allowed).toBe(false);
  });
  it("only matched verified payment unlocks an activated release", () => {
    expect(phoneUpgradeDecision({ choice: "updated_phone", releaseId: "r1", payerId: "p1", amountMinor: 100, activated: true, verifiedPayment: { releaseId: "r1", payerId: "p1", verifiedByArchitect: true } }).allowed).toBe(true);
  });
  it.each(["HQ", "IT", "agent"])("%s cannot approve using a token without Architect identity", async () => {
    identity.architectFromRequest.mockResolvedValue(null);
    await expect(approve({ session: "not-an-architect-token" })).rejects.toThrow("Verified Architect session required");
    expect(identity.architectSessionValid).not.toHaveBeenCalled();
  });
  it("Architect identity still requires its valid protected session", async () => {
    identity.architectFromRequest.mockResolvedValue({ userId: "architect" });
    identity.architectSessionValid.mockReturnValue(false);
    await expect(approve({ session: "expired-architect-session" })).rejects.toThrow("Verified Architect session required");
  });
  it("valid Architect cannot activate or issue a bill while price is pending", async () => {
    identity.architectFromRequest.mockResolvedValue({ userId: "architect" });
    identity.architectSessionValid.mockReturnValue(true);
    await expect(approve({ session: "valid-architect-session" })).rejects.toThrow("owner confirmation");
    await expect(request({})).resolves.toEqual({ issued: false, phase: "awaiting_owner_price" });
  });
});