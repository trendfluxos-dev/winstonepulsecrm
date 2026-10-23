/**
 * Unit inventory JSON backup format + pure validation/restore planning (client- and server-safe).
 * The server always recomputes checksums and plans; nothing in a file is trusted.
 */
import type { Unit } from "@/lib/unit-inventory.functions";

export const BACKUP_FORMAT = "winstone-unit-inventory-backup";
export const BACKUP_FORMAT_VERSION = 1;
export const SCHEMA_VERSION = 1;
export const MAX_BACKUP_UNITS = 5000;
const STATUSES = ["available", "booked", "sold", "blocked"] as const;
const KINDS = ["apartment", "commercial", "plot"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UnitBackup = {
  format: typeof BACKUP_FORMAT; formatVersion: number; schemaVersion: number; exportedAt: string; environment: string;
  recordCount: number; checksum: string; statusCounts: Record<string, number>; units: Unit[];
};

const FIELDS = ["id", "projectId", "projectName", "code", "kind", "floor", "sizeSqft", "sizeKatha", "bedrooms", "bathrooms", "priceBdt", "status", "updatedBy", "updatedAt"] as const;
const CONTENT = ["projectId", "code", "kind", "floor", "sizeSqft", "sizeKatha", "bedrooms", "bathrooms", "priceBdt", "status"] as const;

function canonical(units: Unit[]): string {
  return JSON.stringify([...units].sort((a, b) => a.id.localeCompare(b.id)).map((u) => FIELDS.map((f) => u[f] ?? null)));
}
export async function unitsChecksum(units: Unit[]): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(units)));
  return "sha256:" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function statusCounts(units: Unit[]) {
  const c: Record<string, number> = { available: 0, booked: 0, sold: 0, blocked: 0 };
  for (const u of units) c[u.status] = (c[u.status] ?? 0) + 1;
  return c;
}
export function backupFilename(at: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `unit-inventory-backup-${at.getUTCFullYear()}-${p(at.getUTCMonth() + 1)}-${p(at.getUTCDate())}-${p(at.getUTCHours())}${p(at.getUTCMinutes())}${p(at.getUTCSeconds())}.json`;
}
export async function buildBackup(units: Unit[], environment: string, at = new Date()): Promise<UnitBackup> {
  return { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: at.toISOString(), environment,
    recordCount: units.length, checksum: await unitsChecksum(units), statusCounts: statusCounts(units), units };
}

const num = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
const str = (v: unknown, max: number, nullable = false) => (nullable && v === null) || (typeof v === "string" && v.length <= max);

/** Validates structure, versions, fields, statuses, duplicates, count and a recomputed checksum. */
export async function validateBackup(raw: unknown): Promise<{ ok: true; backup: UnitBackup; errors: [] } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["Not a backup object"] };
  const b = raw as Record<string, unknown>;
  if (b.format !== BACKUP_FORMAT) errors.push("Unknown backup format");
  if (b.formatVersion !== BACKUP_FORMAT_VERSION) errors.push(`Unsupported format version: ${String(b.formatVersion)}`);
  if (b.schemaVersion !== SCHEMA_VERSION) errors.push(`Unsupported schema version: ${String(b.schemaVersion)}`);
  if (typeof b.exportedAt !== "string" || Number.isNaN(Date.parse(b.exportedAt))) errors.push("Missing or invalid exportedAt");
  if (!Array.isArray(b.units)) return { ok: false, errors: [...errors, "units must be an array"] };
  if (b.units.length > MAX_BACKUP_UNITS) return { ok: false, errors: [...errors, `Too many units (max ${MAX_BACKUP_UNITS})`] };
  const seenId = new Set<string>(); const seenCode = new Set<string>();
  b.units.forEach((x, i) => {
    const u = x as Record<string, unknown>; const at = `units[${i}]`;
    if (!u || typeof u !== "object") { errors.push(`${at}: not an object`); return; }
    if (typeof u.id !== "string" || !UUID.test(u.id)) errors.push(`${at}: invalid id`);
    else if (seenId.has(u.id)) errors.push(`${at}: duplicate id ${u.id}`); else seenId.add(u.id);
    if (typeof u.projectId !== "string" || !UUID.test(u.projectId)) errors.push(`${at}: invalid projectId`);
    if (!str(u.projectName, 200)) errors.push(`${at}: invalid projectName`);
    if (typeof u.code !== "string" || !u.code.trim() || u.code.length > 40) errors.push(`${at}: invalid code`);
    else { const k = `${String(u.projectId)}|${u.code.toLowerCase()}`; if (seenCode.has(k)) errors.push(`${at}: duplicate unit code ${u.code}`); seenCode.add(k); }
    if (!KINDS.includes(u.kind as never)) errors.push(`${at}: invalid kind`);
    if (!STATUSES.includes(u.status as never)) errors.push(`${at}: invalid status`);
    if (!str(u.floor, 20, true)) errors.push(`${at}: invalid floor`);
    for (const f of ["sizeSqft", "sizeKatha", "bedrooms", "bathrooms", "priceBdt"]) if (!num(u[f])) errors.push(`${at}: invalid ${f}`);
    if (!str(u.updatedBy, 200)) errors.push(`${at}: invalid updatedBy`);
    if (typeof u.updatedAt !== "string" || Number.isNaN(Date.parse(u.updatedAt))) errors.push(`${at}: invalid updatedAt`);
  });
  if (b.recordCount !== b.units.length) errors.push(`Record count mismatch: header ${String(b.recordCount)}, file ${b.units.length}`);
  if (errors.length) return { ok: false, errors: errors.slice(0, 200) };
  const units = (b.units as Record<string, unknown>[]).map((u) => Object.fromEntries(FIELDS.map((f) => [f, u[f] ?? null])) as Unit);
  const sum = await unitsChecksum(units);
  if (b.checksum !== sum) return { ok: false, errors: ["Checksum mismatch — file was changed or corrupted"] };
  return { ok: true, errors: [], backup: { ...(b as unknown as UnitBackup), units } };
}

export type RestorePlan = {
  add: Unit[]; unchanged: string[]; conflicts: { backup: Unit; live: Unit }[];
  skipped: { id: string; code: string; reason: string }[]; liveOnly: string[];
};
const same = (a: Unit, b: Unit) => CONTENT.every((f) => (a[f] ?? null) === (b[f] ?? null));

/** Compares a validated backup with live units by stable id. Never decides a conflict by itself. */
export function planRestore(backup: Unit[], live: Unit[], projectIds: Set<string>): RestorePlan {
  const byId = new Map(live.map((u) => [u.id, u]));
  const byCode = new Map(live.map((u) => [`${u.projectId}|${u.code.toLowerCase()}`, u]));
  const plan: RestorePlan = { add: [], unchanged: [], conflicts: [], skipped: [], liveOnly: [] };
  const inBackup = new Set(backup.map((u) => u.id));
  for (const u of backup) {
    const l = byId.get(u.id);
    if (l) { if (same(u, l)) plan.unchanged.push(u.id); else plan.conflicts.push({ backup: u, live: l }); continue; }
    if (!projectIds.has(u.projectId)) { plan.skipped.push({ id: u.id, code: u.code, reason: "Project no longer exists" }); continue; }
    const clash = byCode.get(`${u.projectId}|${u.code.toLowerCase()}`);
    if (clash) { plan.skipped.push({ id: u.id, code: u.code, reason: `Code already used by another live unit (${clash.id})` }); continue; }
    plan.add.push(u);
  }
  plan.liveOnly = live.filter((u) => !inBackup.has(u.id)).map((u) => u.id);
  return plan;
}
export function planSummary(p: RestorePlan) {
  return { add: p.add.length, unchanged: p.unchanged.length, conflicts: p.conflicts.length, skipped: p.skipped.length, liveOnly: p.liveOnly.length };
}
