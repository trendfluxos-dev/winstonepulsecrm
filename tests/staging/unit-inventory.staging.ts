/**
 * STAGING-ONLY: unit create → edit → blocked → re-read against a REAL isolated database.
 * Refuses the live CRM (same guard as call-flow.staging.ts). Units can never be deleted by design,
 * so the "[STAGING-E2E]" project and unit stay in the staging database (no cleanup possible).
 *   STAGING_E2E=1 STAGING_CONFIRM=<staging-ref> bunx vitest run --config vitest.staging.config.ts tests/staging/unit-inventory.staging.ts
 */
import { describe, expect, it } from "vitest";
import { stagingGuard } from "./call-flow.staging";
import { saveUnitCore } from "@/lib/unit-inventory.server";

const blocked = stagingGuard();
if (blocked) throw new Error(`[staging-e2e] ${blocked}`);

describe("unit inventory persistence (staging DB)", () => {
  it("persists create, edit and blocked status with audit history", async () => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const tag = `[STAGING-E2E] ${Date.now()}`;
    const { data: proj, error: pe } = await db.from("project_catalog").insert({ name: tag, status: "active" } as never).select("id, name").single();
    if (pe || !proj) throw pe ?? new Error("project insert failed");
    const read = async () => ((await db.from("project_units").select("*").eq("project_id", proj.id)).data ?? []);
    const store = {
      listUnits: async () => (await read()).map((r) => ({ id: r.id, projectId: r.project_id, projectName: r.project_name, code: r.code, kind: r.kind as "apartment",
        floor: r.floor, sizeSqft: r.size_sqft, sizeKatha: r.size_katha, bedrooms: r.bedrooms, bathrooms: r.bathrooms, priceBdt: r.price_bdt,
        status: r.status as "available", updatedBy: r.updated_by, updatedAt: r.updated_at })),
      project: async () => proj,
      upsertUnit: async (u: import("@/lib/unit-inventory.functions").Unit) => {
        const { error } = await db.from("project_units").upsert({ id: u.id, project_id: u.projectId, project_name: u.projectName, code: u.code, kind: u.kind, floor: u.floor,
          size_sqft: u.sizeSqft, size_katha: u.sizeKatha, bedrooms: u.bedrooms, bathrooms: u.bathrooms, price_bdt: u.priceBdt, status: u.status, updated_by: u.updatedBy, updated_at: u.updatedAt });
        if (error) throw error;
      },
      audit: async (action: string, metadata: Record<string, unknown>) => { await db.from("audit_logs").insert({ action, entity_type: "project_unit", actor_label: tag, metadata: metadata as never }); },
    };
    const it = { scope: "authority" as const, agentId: null, readOnly: false, actor: tag };
    const base = { id: null, projectId: proj.id, code: "E2E-1", kind: "apartment" as const, floor: "2", sizeSqft: 1000, sizeKatha: null, bedrooms: 2, bathrooms: 2, priceBdt: 9_000_000, status: "available" as const };
    const { id } = await saveUnitCore(store, it, base);
    await saveUnitCore(store, it, { ...base, id, floor: "9", priceBdt: 9_900_000 });
    await saveUnitCore(store, it, { ...base, id, floor: "9", priceBdt: 9_900_000, status: "blocked" as never });
    const rows = await read();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, floor: "9", price_bdt: 9_900_000, status: "blocked" });
    const { error: delErr } = await db.from("project_units").delete().eq("id", id);
    expect(delErr).not.toBeNull();
    const { data: logs } = await db.from("audit_logs").select("action").eq("actor_label", tag).eq("entity_type", "project_unit");
    expect((logs ?? []).map((l) => l.action).sort()).toEqual(["unit_created", "unit_updated", "unit_updated"]);
  });
});
