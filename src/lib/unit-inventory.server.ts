import type { Unit } from "@/lib/unit-inventory.functions";
import type { SiCaller } from "@/lib/sales-intel.server";

export type UnitInput = Omit<Unit, "id" | "projectName" | "updatedBy" | "updatedAt"> & { id: string | null };
/** Storage seam so save rules are testable without touching the shared live database. */
export type UnitStore = {
  listUnits(): Promise<Unit[]>;
  project(id: string): Promise<{ id: string; name: string } | null>;
  upsertUnit(u: Unit): Promise<void>;
  audit(action: string, metadata: Record<string, unknown>): Promise<void>;
};
const STATUSES = new Set(["available", "booked", "sold", "blocked"]);

/** Creates or edits one unit. Never deletes; a failed write leaves the stored unit unchanged. */
export async function saveUnitCore(store: UnitStore, c: SiCaller, data: UnitInput, newId: () => string = () => crypto.randomUUID(), now = new Date()) {
  if (c.scope !== "authority") throw new Error("HQ/IT only");
  if (c.readOnly) throw new Error("Executive HQ is view-only");
  if (!STATUSES.has(data.status)) throw new Error("Invalid status");
  const units = await store.listUnits();
  const p = await store.project(data.projectId);
  if (!p) throw new Error("Project not found / প্রজেক্ট পাওয়া যায়নি");
  if (units.some((u) => u.projectId === data.projectId && u.code.toLowerCase() === data.code.toLowerCase() && u.id !== data.id))
    throw new Error("Unit code already exists / এই ইউনিট কোড আছে");
  const prev = data.id ? units.find((u) => u.id === data.id) : undefined;
  if (data.id && !prev) throw new Error("Unit not found");
  const unit: Unit = { ...data, id: data.id ?? newId(), projectId: p.id, projectName: p.name, updatedBy: c.actor, updatedAt: now.toISOString() };
  try { await store.upsertUnit(unit); } catch { throw new Error("Unit not saved / সংরক্ষণ হয়নি"); }
  await store.audit(prev ? "unit_updated" : "unit_created", { unitId: unit.id, unit: unit.code, project: p.name, from: prev?.status ?? null, to: unit.status });
  return { ok: true as const, id: unit.id };
}
