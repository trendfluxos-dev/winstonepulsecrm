/** New upgrade fee only; never changes the monthly maintenance contract. */
export const PHONE_UPGRADE_CUTOFF = "2026-10-28T18:00:00.000Z"; // Oct 29 00:00 Dhaka
export const PHONE_UPGRADE_PREPARATION = {
  phase: "awaiting_owner_price" as const,
  amountMinor: null,
  currency: null,
  payerScope: null,
  activated: false,
  approver: "verified_architect" as const,
};

export function isLegacyPhoneRelease(releasedAt: string): boolean {
  const at = Date.parse(releasedAt);
  return Number.isFinite(at) && at < Date.parse(PHONE_UPGRADE_CUTOFF);
}

export function phoneUpgradeDecision(input: {
  choice: "preview" | "updated_phone";
  releaseId?: string | null;
  amountMinor: number | null;
  activated: boolean;
  verifiedPayment?: { releaseId: string; payerId: string; verifiedByArchitect: boolean } | null;
  payerId?: string;
}) {
  if (input.choice === "preview") return { allowed: true, reason: "no_new_upgrade_fee" as const };
  if (!input.releaseId) return { allowed: false, reason: "release_unconfirmed" as const };
  if (input.amountMinor === null || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) return { allowed: false, reason: "price_unconfirmed" as const };
  if (!input.activated) return { allowed: false, reason: "not_activated" as const };
  const proof = input.verifiedPayment;
  if (!input.payerId || !proof?.verifiedByArchitect || proof.releaseId !== input.releaseId || proof.payerId !== input.payerId) return { allowed: false, reason: "architect_payment_required" as const };
  return { allowed: true, reason: "architect_payment_verified" as const };
}

/** Until the owner confirms pricing and payer scope no payable bill may be issued. */
export function assertPhoneUpgradeReady(): never {
  throw new Error("Phone upgrade price awaits owner confirmation; billing and paid release distribution are not activated.");
}