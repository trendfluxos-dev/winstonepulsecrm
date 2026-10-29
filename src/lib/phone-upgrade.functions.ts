import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PHONE_UPGRADE_CUTOFF, PHONE_UPGRADE_PREPARATION, assertPhoneUpgradeReady } from "@/lib/phone-upgrade";

/** Public preparation only. No amounts, invoice details, customer data or writes. */
export const getPhoneUpgradePreparation = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("app_releases")
    .select("id, version_code, version_name, released_at, storage_path")
    .lt("released_at", PHONE_UPGRADE_CUTOFF)
    .order("version_code", { ascending: false }).limit(1).maybeSingle();
  if (error) return { ...PHONE_UPGRADE_PREPARATION, legacyRelease: null, archiveState: "unavailable" as const };
  // Metadata alone never proves the APK bytes still exist.
  let archived = false;
  if (data?.storage_path && data.storage_path.startsWith("releases/")) {
    const filename = data.storage_path.split("/").pop();
    if (filename) {
      const result = await supabaseAdmin.storage.from("app-downloads").list(data.storage_path.substring(0, data.storage_path.lastIndexOf("/")), { search: filename, limit: 1 });
      archived = !result.error && Boolean(result.data?.some(file => file.name === filename));
    }
  }
  return {
    ...PHONE_UPGRADE_PREPARATION,
    legacyRelease: data ? { id: data.id, versionCode: data.version_code, versionName: data.version_name, releasedAt: data.released_at } : null,
    archiveState: archived ? "verified" as const : "unconfirmed" as const,
  };
});

/** An ordinary user cannot manufacture a bill/unlock through browser state. */
export const requestPhoneUpgradeBill = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({}).strict().parse(input))
  .handler(async () => assertPhoneUpgradeReady());

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