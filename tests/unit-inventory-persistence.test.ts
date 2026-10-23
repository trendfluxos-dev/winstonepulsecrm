/**
 * Unit create → edit → block → reload persistence, run against an in-memory store that enforces the same
 * rules as the real table (unique project+code, statuses, no deletes). Preview and live share one database
 * and units can never be deleted, so real-database runs live in tests/staging/unit-inventory.staging.ts.
 */
import { describe, expect, it } from "vitest";
import { saveUnitCore, type UnitInput, type UnitStore } from "@/lib/unit-inventory.server";
import type { SiCaller } from "@/lib/sales-intel.server";
import type { Unit } from "@/lib/unit-inventory.functions";

const P = "22222222-2222-4222-8222-222222222222";
const IT: SiCaller = { scope: "authority", agentId: null, readOnly: false, actor: "IT Console" };

function memoryDb(opts: { failWrites?: boolean } = {}) {
  const rows = new Map<string, Unit>(); const audit: { action: string; metadata: Record<string, unknown> }[] = [];
  let n = 0;
  const store: UnitStore = {
    listUnits: async () => [...rows.values()].map((u) => ({ ...u })), // fresh copy = what a page reload reads
    project: async (id) => (id === P ? { id: P, name: "[TEST] Tower" } : null),
    upsertUnit: async (u) => {
      if (opts.failWrites) throw new Error("connection reset");
      if (!["available", "booked", "sold", "blocked"].includes(u.status)) throw new Error("check violation");
      if ([...rows.values()].some((r) => r.id !== u.id && r.projectId === u.projectId && r.code.toLowerCase() === u.code.toLowerCase())) throw new Error("unique violation");
      rows.set(u.id, { ...u });
    },
    audit: async (action, metadata) => { audit.push({ action, metadata }); },
  };
  const deleteUnit = (id: string) => { void id; throw new Error("Units are never deleted; mark them blocked"); };
  return { store, rows, audit, deleteUnit, newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` };
}
const input = (o: Partial<UnitInput> = {}): UnitInput => ({ id: null, projectId: P, code: `TEST-${Date.now()}`, kind: "apartment", floor: "4",
  sizeSqft: 1350, sizeKatha: null, bedrooms: 3, bathrooms: 2, priceBdt: 12_000_000, status: "available", ...o });

describe("unit inventory persistence", () => {
  it("create → edit → blocked survives a reload with the same id, values and audit history", async () => {
    const db = memoryDb();
    const base = input();
    const { id } = await saveUnitCore(db.store, IT, base, db.newId);                         // Step A
    expect((await db.store.listUnits()).map((u) => u.id)).toEqual([id]);
    await saveUnitCore(db.store, IT, { ...base, id, floor: "7", priceBdt: 13_500_000, bedrooms: 4 }, db.newId); // Step B
    await saveUnitCore(db.store, IT, { ...base, id, floor: "7", priceBdt: 13_500_000, bedrooms: 4, status: "blocked" }, db.newId); // Step C
    const reloaded = await db.store.listUnits();                                              // Step D
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]).toMatchObject({ id, code: base.code, floor: "7", priceBdt: 13_500_000, bedrooms: 4, status: "blocked", updatedBy: "IT Console" });
    expect(db.audit.map((a) => a.action)).toEqual(["unit_created", "unit_updated", "unit_updated"]); // Step E
    expect(db.audit[2].metadata).toMatchObject({ unitId: id, from: "available", to: "blocked" });
  });
  it("a failed write leaves the stored unit unchanged after reload and writes no audit entry", async () => {
    const db = memoryDb();
    const { id } = await saveUnitCore(db.store, IT, input({ code: "TEST-F" }), db.newId);
    const failing = { ...db.store, upsertUnit: async () => { throw new Error("network down"); } };
    await expect(saveUnitCore(failing, IT, input({ id, code: "TEST-F", status: "sold" }), db.newId)).rejects.toThrow("Unit not saved");
    expect((await db.store.listUnits())[0].status).toBe("available");
    expect(db.audit).toHaveLength(1);
  });
  it("database outage on create stores nothing", async () => {
    const db = memoryDb({ failWrites: true });
    await expect(saveUnitCore(db.store, IT, input(), db.newId)).rejects.toThrow("Unit not saved");
    expect(db.rows.size).toBe(0);
  });
  it("rejects agents and view-only HQ without writing", async () => {
    const db = memoryDb();
    await expect(saveUnitCore(db.store, { scope: "agent", agentId: "a", readOnly: false, actor: "Agent" }, input(), db.newId)).rejects.toThrow();
    await expect(saveUnitCore(db.store, { ...IT, readOnly: true }, input(), db.newId)).rejects.toThrow("view-only");
    expect(db.rows.size).toBe(0);
  });
  it("rejects an invalid status", async () => {
    const db = memoryDb();
    await expect(saveUnitCore(db.store, IT, input({ status: "deleted" as never }), db.newId)).rejects.toThrow("Invalid status");
    expect(db.rows.size).toBe(0);
  });
  it("repeated saves of the same unit never create duplicates; a second create with the same code is refused", async () => {
    const db = memoryDb();
    const base = input({ code: "TEST-DUP" });
    const { id } = await saveUnitCore(db.store, IT, base, db.newId);
    for (let i = 0; i < 3; i++) await saveUnitCore(db.store, IT, { ...base, id }, db.newId);
    await expect(saveUnitCore(db.store, IT, base, db.newId)).rejects.toThrow("already exists");
    expect(db.rows.size).toBe(1);
  });
  it("blocked units stay present and cannot be deleted", async () => {
    const db = memoryDb();
    const { id } = await saveUnitCore(db.store, IT, input({ status: "blocked" }), db.newId);
    expect(() => db.deleteUnit(id)).toThrow("never deleted");
    expect((await db.store.listUnits())[0]).toMatchObject({ id, status: "blocked" });
  });
});
