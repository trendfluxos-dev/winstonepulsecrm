import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PHONE_UPGRADE_PREPARATION, assertPhoneUpgradeReady } from "@/lib/phone-upgrade";

// Retired 2026-10-30: the public release-preparation read was removed; no caller remains.

/** An ordinary user cannot manufacture a bill/unlock through browser state. */
export const requestPhoneUpgradeBill = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({}).strict().parse(input))
  .handler(async () => ({ issued: false as const, phase: PHONE_UPGRADE_PREPARATION.phase }));

/** Same verified Google identity AND protected Architect session as /tech. */
export const approvePhoneUpgrade = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ session: z.string().min(10).max(512) }).strict().parse(input))
  .handler(async ({ data }) => {
    const m = await import("@/lib/maintenance.server");
    const who = await m.architectFromRequest();
    if (!who || !m.architectSessionValid(data.session, who.userId)) throw new Error("Verified Architect session required");
    // Fail before any financial write while the owner amount is pending.
    return assertPhoneUpgradeReady();
  });