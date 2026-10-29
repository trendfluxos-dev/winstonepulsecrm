import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AppConfigSchema, DEFAULT_CONFIG, parseConfig } from "@/lib/crm-config";

/**
 * Live rules for every device. The MCP allow-list (mcpAllowedEmails) is
 * internal configuration: it is only included when the caller presents a
 * valid master/IT PIN. Everyone else receives the config with it stripped.
 */
export const getAppConfig = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    // Private settings: only approved staff (session) or a valid PIN may read them.
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("Sign in required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("app_config")
      .select("data, updated_at")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const config = parseConfig(row?.data ?? {});
    let includeAllowlist = false;
    if (data.adminToken) {
      try {
        const { requireAdminToken } = await import("@/lib/admin-gate.server");
        requireAdminToken(data.adminToken);
        includeAllowlist = true;
      } catch {
        includeAllowlist = false;
      }
    }
    return {
      config: includeAllowlist ? config : { ...config, mcpAllowedEmails: [] },
      updatedAt: row?.updated_at ?? null,
    };
  });

/** Saves the IT customizer. Master or IT console PIN required. */
export const saveAppConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().min(1), config: AppConfigSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_config")
      .upsert({ id: "default", data: data.config, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true as const, config: data.config };
  });

/** Restores the shipped defaults. */
export const resetAppConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_config")
      .upsert({ id: "default", data: DEFAULT_CONFIG, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true as const, config: DEFAULT_CONFIG };
  });
