import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBackup, validateBackup } from "@/lib/unit-backup";
import { applyRestore, exportBackup, previewRestore, type BackupStore } from "@/lib/unit-backup.server";
import { requireAdminWriter } from "@/lib/sales-intel.server";
import type { Unit } from "@/lib/unit-inventory.functions";

const P = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const unit = (n: number, o: Partial<Unit> = {}): Unit => ({ id: id(n), projectId: P, projectName: "Test Tower", code: `A-${n}`, kind: "apartment", floor: "3",
  sizeSqft: 1200, sizeKatha: null, bedrooms: 3, bathrooms: 2, priceBdt: 9_500_000, status: "available", updatedBy: "IT", updatedAt: "2026-10-01T00:00:00.000Z", ...o });

function fakeStore(initial: Unit[], opts: { failWrite?: boolean; failSnapshot?: boolean } = {}) {
  const live = new Map(initial.map((u) => [u.id, u]));
  const snaps = new Map<string, unknown>(); const audits: { action: string; metadata: Record<string, unknown> }[] = [];
  const store: BackupStore = {
    listUnits: async () => [...live.values()],
    projectIds: async () => new Set([P]),
    insertUnits: async (us) => { if (opts.failWrite) throw new Error("db down"); if (us.some((u) => live.has(u.id))) throw new Error("dup"); us.forEach((u) => live.set(u.id, u)); },
    upsertUnits: async (us) => { if (opts.failWrite) throw new Error("db down"); us.forEach((u) => live.set(u.id, u)); },
    saveSnapshot: async (s) => { if (opts.failSnapshot) throw new Error("x"); const k = `snap-${snaps.size}`; snaps.set(k, JSON.parse(JSON.stringify(s.payload))); return k; },
    readSnapshot: async (k) => (snaps.has(k) ? { payload: snaps.get(k) } : null),
    audit: async (action, metadata) => { audits.push({ action, metadata }); },
  };
  return { store, live, snaps, audits };
}
const json = (b: unknown) => JSON.parse(JSON.stringify(b)) as unknown;
async function req(store: BackupStore, backup: unknown, mode: "merge" | "full", overwriteIds: string[] = [], confirmFull = mode === "full") {
  const p = await previewRestore(store, backup);
  if (!p.ok) throw new Error(p.errors.join());
  return applyRestore(store, { backup, filename: "b.json", mode, overwriteIds, expectedLiveChecksum: p.liveChecksum, confirmFull }, "IT Console");
}

describe("unit inventory JSON backup", () => {
  it("exports every record with counts, versions and checksum, and audits it", async () => {
    const { store, audits } = fakeStore([unit(1), unit(2, { status: "sold" }), unit(3, { status: "blocked" })]);
    const r = await exportBackup(store, "test", "IT", new Date("2026-10-23T12:30:05Z"));
    expect(r.filename).toBe("unit-inventory-backup-2026-10-23-123005.json");
    expect(r.backup.recordCount).toBe(3);
    expect(r.backup.statusCounts).toEqual({ available: 1, booked: 0, sold: 1, blocked: 1 });
    expect(r.backup.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(audits[0]).toMatchObject({ action: "unit_backup_exported", metadata: { records: 3 } });
  });
  it("exports an empty inventory as a valid backup", async () => {
    const r = await exportBackup(fakeStore([]).store, "test", "IT");
    expect(r.backup.recordCount).toBe(0);
    expect((await validateBackup(json(r.backup))).ok).toBe(true);
  });
  it("round-trips: export then restore into empty inventory recreates all units", async () => {
    const b = json((await exportBackup(fakeStore([unit(1), unit(2)]).store, "t", "IT")).backup);
    const target = fakeStore([]);
    const r = await req(target.store, b, "merge");
    expect(r).toMatchObject({ ok: true, added: 2, updated: 0 });
    expect([...target.live.values()].map((u) => u.code).sort()).toEqual(["A-1", "A-2"]);
  });
  it("rejects corrupted, tampered, unsupported and duplicate files", async () => {
    const good = json(await buildBackup([unit(1)], "t")) as Record<string, unknown>;
    expect((await validateBackup("nope")).ok).toBe(false);
    expect((await validateBackup({ ...good, schemaVersion: 2 })).ok).toBe(false);
    expect((await validateBackup({ ...good, formatVersion: 9 })).ok).toBe(false);
    const tampered = json(good) as { units: Unit[] }; tampered.units[0].status = "sold";
    const t = await validateBackup(tampered);
    expect(t.ok ? [] : t.errors).toContain("Checksum mismatch — file was changed or corrupted");
    const dup = await validateBackup({ ...good, recordCount: 2, units: [unit(1), unit(1)] });
    expect(dup.ok ? "" : dup.errors.join()).toMatch(/duplicate id/);
    expect((await validateBackup({ ...good, units: [{ ...unit(1), status: "gone" }] })).ok).toBe(false);
  });
  it("safe merge never overwrites a conflicting live unit unless explicitly chosen", async () => {
    const b = json(await buildBackup([unit(1, { status: "available" }), unit(2)], "t"));
    const s = fakeStore([unit(1, { status: "sold" })]);
    const r = await req(s.store, b, "merge");
    expect(r).toMatchObject({ ok: true, added: 1, updated: 0, keptLive: 1 });
    expect(s.live.get(id(1))?.status).toBe("sold");
    expect(s.snaps.size).toBe(0);
  });
  it("merge with explicit resolution saves a verified pre-restore backup first", async () => {
    const s = fakeStore([unit(1, { status: "sold" })]);
    const r = await req(s.store, json(await buildBackup([unit(1)], "t")), "merge", [id(1)]);
    expect(r).toMatchObject({ ok: true, updated: 1 });
    expect(s.live.get(id(1))?.status).toBe("available");
    expect(((s.snaps.get("snap-0") as { units: Unit[] }).units[0]).status).toBe("sold");
  });
  it("full restore needs second confirmation, keeps live-only units and the pre-restore backup", async () => {
    const b = json(await buildBackup([unit(1)], "t"));
    const s = fakeStore([unit(1, { status: "booked" }), unit(9)]);
    const no = await req(s.store, b, "full", [], false);
    expect(no.ok).toBe(false);
    expect(s.live.get(id(1))?.status).toBe("booked");
    const r = await req(s.store, b, "full");
    expect(r).toMatchObject({ ok: true, updated: 1, liveOnlyKept: 1 });
    expect(s.live.has(id(9))).toBe(true);
    expect(s.snaps.size).toBe(1);
    expect(s.audits.map((a) => a.action)).toContain("unit_restore_full");
  });
  it("stops without changes when the pre-restore backup cannot be saved", async () => {
    const s = fakeStore([unit(1, { status: "sold" })], { failSnapshot: true });
    const r = await req(s.store, json(await buildBackup([unit(1)], "t")), "full");
    expect(r.ok).toBe(false);
    expect(s.live.get(id(1))?.status).toBe("sold");
  });
  it("database write failure keeps live units and records a failed audit entry", async () => {
    const s = fakeStore([unit(1)], { failWrite: true });
    const r = await req(s.store, json(await buildBackup([unit(1), unit(2)], "t")), "merge");
    expect(r.ok).toBe(false);
    expect(s.live.size).toBe(1);
    expect(s.audits.at(-1)?.action).toBe("unit_restore_failed");
  });
  it("refuses to apply when live data changed after the preview", async () => {
    const s = fakeStore([unit(1)]);
    const b = json(await buildBackup([unit(2)], "t"));
    const p = await previewRestore(s.store, b);
    s.live.set(id(3), unit(3));
    const r = await applyRestore(s.store, { backup: b, filename: "b", mode: "merge", overwriteIds: [], expectedLiveChecksum: p.ok ? p.liveChecksum : "", confirmFull: false }, "IT");
    expect(r.ok).toBe(false);
    expect(s.live.has(id(2))).toBe(false);
  });
  it("blocks unauthorized export/restore", () => {
    expect(() => requireAdminWriter({ scope: "agent", agentId: "a", readOnly: false, actor: "x" })).toThrow();
    expect(() => requireAdminWriter({ scope: "authority", agentId: null, readOnly: true, actor: "HQ" })).toThrow();
    const src = readFileSync("src/lib/unit-inventory.functions.ts", "utf8");
    const block = (name: string) => src.slice(src.indexOf(`export const ${name}`), src.indexOf("});", src.indexOf(`export const ${name}`)));
    expect(block("exportUnitBackup")).toMatch(/scope !== "authority"/);
    expect(block("previewUnitRestore")).toMatch(/requireAdminWriter\(c\)/);
    expect(block("applyUnitRestore")).toMatch(/requireAdminWriter\(c\)/);
  });
});
