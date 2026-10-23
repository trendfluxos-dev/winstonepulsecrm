import type { Unit } from "@/lib/unit-inventory.functions";
import { buildBackup, backupFilename, planRestore, planSummary, unitsChecksum, validateBackup, BACKUP_FORMAT_VERSION } from "@/lib/unit-backup";

/** Storage seam so restore safety rules are testable without the live database. */
export type BackupStore = {
  listUnits(): Promise<Unit[]>;
  projectIds(): Promise<Set<string>>;
  /** Insert-only; must fail (not overwrite) on existing ids. One call = one transaction. */
  insertUnits(units: Unit[]): Promise<void>;
  /** Upsert by id in one statement (one transaction). */
  upsertUnits(units: Unit[]): Promise<void>;
  saveSnapshot(s: { reason: string; filename: string; recordCount: number; checksum: string; payload: unknown; createdBy: string }): Promise<string>;
  readSnapshot(id: string): Promise<{ payload: unknown } | null>;
  audit(action: string, metadata: Record<string, unknown>): Promise<void>;
};
export type RestoreRequest = { backup: unknown; filename: string; mode: "merge" | "full"; overwriteIds: string[]; expectedLiveChecksum: string; confirmFull: boolean };

export async function exportBackup(store: BackupStore, env: string, actor: string, now = new Date()) {
  const units = await store.listUnits();
  const backup = await buildBackup(units, env, now);
  const filename = backupFilename(now);
  await store.audit("unit_backup_exported", { filename, formatVersion: BACKUP_FORMAT_VERSION, records: units.length, checksum: backup.checksum, status: "success", actor });
  return { filename, backup };
}

export async function previewRestore(store: BackupStore, raw: unknown) {
  const v = await validateBackup(raw);
  if (!v.ok) return { ok: false as const, errors: v.errors };
  const live = await store.listUnits();
  const plan = planRestore(v.backup.units, live, await store.projectIds());
  return { ok: true as const, errors: [] as string[], recordCount: v.backup.recordCount, statusCounts: v.backup.statusCounts, exportedAt: v.backup.exportedAt,
    environment: v.backup.environment, liveChecksum: await unitsChecksum(live), summary: planSummary(plan),
    conflicts: plan.conflicts.map((c) => ({ id: c.backup.id, code: c.backup.code, backupStatus: c.backup.status, liveStatus: c.live.status, liveUpdatedAt: c.live.updatedAt, backupUpdatedAt: c.backup.updatedAt })),
    skipped: plan.skipped };
}

export async function applyRestore(store: BackupStore, req: RestoreRequest, actor: string, now = new Date()) {
  const base = { filename: req.filename.slice(0, 120), formatVersion: BACKUP_FORMAT_VERSION, mode: req.mode, actor };
  const fail = async (error: string, extra: Record<string, unknown> = {}) => {
    await store.audit("unit_restore_failed", { ...base, ...extra, status: "failed", error }).catch(() => undefined);
    return { ok: false as const, error };
  };
  const v = await validateBackup(req.backup);
  if (!v.ok) return fail("Backup failed validation", { rejected: v.errors.length });
  if (req.mode === "full" && !req.confirmFull) return fail("Full restore needs a second confirmation");
  const live = await store.listUnits();
  // Concurrency guard: the plan the admin approved must still describe the live data.
  if ((await unitsChecksum(live)) !== req.expectedLiveChecksum) return fail("Inventory changed since the preview — preview again");
  const plan = planRestore(v.backup.units, live, await store.projectIds());
  const conflictIds = new Set(plan.conflicts.map((c) => c.backup.id));
  const overwrite = req.mode === "full" ? plan.conflicts.map((c) => c.backup) : plan.conflicts.filter((c) => req.overwriteIds.includes(c.backup.id)).map((c) => c.backup);
  if (req.overwriteIds.some((id) => !conflictIds.has(id))) return fail("Overwrite list contains a unit that is not a conflict");
  const counts = { processed: v.backup.units.length, added: plan.add.length, updated: overwrite.length, unchanged: plan.unchanged.length,
    skipped: plan.skipped.length, keptLive: plan.conflicts.length - overwrite.length, liveOnlyKept: plan.liveOnly.length };

  let snapshotId: string | null = null;
  if (overwrite.length) {
    // Verified pre-restore backup of the complete live inventory before anything is changed.
    const pre = await buildBackup(live, v.backup.environment, now);
    try {
      snapshotId = await store.saveSnapshot({ reason: "pre_restore", filename: "pre-restore-" + backupFilename(now), recordCount: live.length, checksum: pre.checksum, payload: pre, createdBy: actor });
      const back = await store.readSnapshot(snapshotId);
      const check = back ? await validateBackup(back.payload) : null;
      if (!check?.ok || check.backup.checksum !== pre.checksum) return fail("Pre-restore backup could not be verified — nothing changed", { snapshotId });
    } catch {
      return fail("Pre-restore backup could not be saved — nothing changed");
    }
  }
  try {
    if (plan.add.length) await store.insertUnits(plan.add);
    if (overwrite.length) await store.upsertUnits(overwrite.map((u) => ({ ...u, updatedBy: `${actor} (restore)`, updatedAt: now.toISOString() })));
  } catch {
    return fail("Database write failed — live units kept; pre-restore backup retained", { snapshotId, ...counts });
  }
  // Verify outcome against the backup.
  const after = new Map((await store.listUnits()).map((u) => [u.id, u]));
  const missing = [...plan.add, ...overwrite].filter((u) => after.get(u.id)?.status !== u.status || after.get(u.id)?.code !== u.code).map((u) => u.id);
  const lostLive = live.filter((u) => !after.has(u.id)).map((u) => u.id);
  if (missing.length || lostLive.length) return fail("Post-restore verification failed", { snapshotId, missing: missing.length, lostLive: lostLive.length });
  await store.audit(req.mode === "full" ? "unit_restore_full" : "unit_restore_merge", { ...base, ...counts, snapshotId, status: "success" });
  return { ok: true as const, ...counts, snapshotId };
}
