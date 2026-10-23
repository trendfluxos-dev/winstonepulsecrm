import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Unit inventory matrix + WhatsApp qualification feed. Server-only; caller resolved via siCaller.
 * Units live in server-only public.project_units (HQ/IT write, everyone signed-in reads; legacy app_config 'unit_inventory' copied once); units are never removed — mark Blocked.
 */
const Token = z.string().nullable().optional();
export const UNIT_STATUSES = ["available", "booked", "sold", "blocked"] as const;
export const UNIT_KINDS = ["apartment", "commercial", "plot"] as const;
export type Unit = {
  id: string; projectId: string; projectName: string; code: string; kind: (typeof UNIT_KINDS)[number]; floor: string | null;
  sizeSqft: number | null; sizeKatha: number | null; bedrooms: number | null; bathrooms: number | null; priceBdt: number | null;
  status: (typeof UNIT_STATUSES)[number]; updatedBy: string; updatedAt: string;
};

type Row = { id: string; project_id: string; project_name: string; code: string; kind: string; floor: string | null; size_sqft: number | null; size_katha: number | null; bedrooms: number | null; bathrooms: number | null; price_bdt: number | null; status: string; updated_by: string; updated_at: string };
const toUnit = (r: Row): Unit => ({ id: r.id, projectId: r.project_id, projectName: r.project_name, code: r.code, kind: r.kind as Unit["kind"], floor: r.floor,
  sizeSqft: r.size_sqft, sizeKatha: r.size_katha, bedrooms: r.bedrooms, bathrooms: r.bathrooms, priceBdt: r.price_bdt,
  status: r.status as Unit["status"], updatedBy: r.updated_by, updatedAt: r.updated_at });
async function load() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("project_units").select("*").order("project_name").order("code").limit(5000);
  if (error) throw new Error("Units unavailable / ইউনিট লোড হয়নি");
  return { db: supabaseAdmin, units: ((data ?? []) as Row[]).map(toUnit) };
}

export const listUnits = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken).catch(() => null);
    if (!c) return { canEdit: false, units: [] as Unit[], projects: [] as { id: string; name: string; location: string | null }[] };
    const { db, units } = await load();
    const { data: projects } = await db.from("project_catalog").select("id, name, location").eq("status", "active").order("name");
    return { canEdit: c.scope === "authority" && !c.readOnly, units, projects: projects ?? [] };
  });

const n = (max: number) => z.number().nonnegative().max(max).nullish().transform((v) => v ?? null);
export const saveUnit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token, id: z.string().uuid().nullish(), projectId: z.string().uuid(), code: z.string().trim().min(1).max(40),
      kind: z.enum(UNIT_KINDS), floor: z.string().trim().max(20).nullish().transform((v) => v || null),
      sizeSqft: n(1_000_000), sizeKatha: n(10_000), bedrooms: n(20), bathrooms: n(20), priceBdt: n(100_000_000_000),
      status: z.enum(UNIT_STATUSES),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { siCaller, requireAdminWriter } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    requireAdminWriter(c);
    const { db, units } = await load();
    const { data: p } = await db.from("project_catalog").select("id, name").eq("id", data.projectId).maybeSingle();
    if (!p) throw new Error("Project not found / প্রজেক্ট পাওয়া যায়নি");
    if (units.some((u) => u.projectId === data.projectId && u.code.toLowerCase() === data.code.toLowerCase() && u.id !== data.id))
      throw new Error("Unit code already exists / এই ইউনিট কোড আছে");
    const prev = data.id ? units.find((u) => u.id === data.id) : undefined;
    if (data.id && !prev) throw new Error("Unit not found");
    const unit: Unit = {
      id: data.id ?? crypto.randomUUID(), projectId: p.id, projectName: p.name, code: data.code, kind: data.kind, floor: data.floor,
      sizeSqft: data.sizeSqft, sizeKatha: data.sizeKatha, bedrooms: data.bedrooms, bathrooms: data.bathrooms, priceBdt: data.priceBdt,
      status: data.status, updatedBy: c.actor, updatedAt: new Date().toISOString(),
    };
    const { error } = await db.from("project_units").upsert({
      id: unit.id, project_id: unit.projectId, project_name: unit.projectName, code: unit.code, kind: unit.kind, floor: unit.floor,
      size_sqft: unit.sizeSqft, size_katha: unit.sizeKatha, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms, price_bdt: unit.priceBdt,
      status: unit.status, updated_by: unit.updatedBy, updated_at: unit.updatedAt,
    });
    if (error) throw new Error("Unit not saved / সংরক্ষণ হয়নি");
    await db.from("audit_logs").insert({
      action: prev ? "unit_updated" : "unit_created", entity_type: "project_unit", entity_id: null,
      actor_profile_id: c.agentId, actor_label: c.actor,
      metadata: { unitId: unit.id, unit: unit.code, project: p.name, from: prev?.status ?? null, to: unit.status },
    });
    return { ok: true };
  });

/** Recent customer WhatsApp messages per lead, scoped to the caller (agents: own leads only). */
export const whatsappQualificationFeed = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken).catch(() => null);
    if (!c) return { rows: [] as { leadId: string; name: string; messages: string[]; lastAt: string }[] };
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    let q = db.from("whatsapp_interactions").select("lead_id, message_content, created_at").eq("sender_type", "customer").eq("message_type", "text").gte("created_at", since).order("created_at").limit(2000);
    if (c.scope === "agent") {
      const { data: own } = await db.from("leads").select("id").eq("assigned_agent_id", c.agentId!).limit(5000);
      const ids = (own ?? []).map((l) => l.id);
      if (!ids.length) return { rows: [] };
      q = q.in("lead_id", ids.slice(0, 500));
    }
    const { data: msgs, error } = await q;
    if (error) throw new Error("WhatsApp messages unavailable");
    const by = new Map<string, { messages: string[]; lastAt: string }>();
    for (const m of msgs ?? []) {
      if (!m.lead_id || !m.message_content) continue;
      const e = by.get(m.lead_id) ?? { messages: [], lastAt: m.created_at };
      e.messages.push(String(m.message_content).slice(0, 1000)); e.lastAt = m.created_at; by.set(m.lead_id, e);
    }
    const ids = [...by.keys()].slice(0, 300);
    if (!ids.length) return { rows: [] };
    const { data: leads } = await db.from("leads").select("id, name").in("id", ids);
    const names = new Map((leads ?? []).map((l) => [l.id, l.name ?? "—"]));
    return { rows: ids.map((id) => ({ leadId: id, name: names.get(id) ?? "—", ...by.get(id)! })) };
  });

/* ---------- JSON backup / restore (HQ/IT). Server recomputes every check; nothing from the file is trusted. ---------- */
async function backupStore(c: { agentId: string | null; actor: string }) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const toRow = (u: Unit) => ({ id: u.id, project_id: u.projectId, project_name: u.projectName, code: u.code, kind: u.kind, floor: u.floor,
    size_sqft: u.sizeSqft, size_katha: u.sizeKatha, bedrooms: u.bedrooms, bathrooms: u.bathrooms, price_bdt: u.priceBdt,
    status: u.status, updated_by: u.updatedBy, updated_at: u.updatedAt });
  const store: import("@/lib/unit-backup.server").BackupStore = {
    listUnits: async () => (await load()).units,
    projectIds: async () => {
      const { data, error } = await db.from("project_catalog").select("id").limit(10000);
      if (error) throw new Error("Projects unavailable");
      return new Set((data ?? []).map((p) => p.id));
    },
    insertUnits: async (units) => { const { error } = await db.from("project_units").insert(units.map(toRow)); if (error) throw new Error("insert failed"); },
    upsertUnits: async (units) => { const { error } = await db.from("project_units").upsert(units.map(toRow)); if (error) throw new Error("upsert failed"); },
    saveSnapshot: async (s) => {
      const { data, error } = await db.from("unit_inventory_backups").insert({ reason: s.reason, filename: s.filename, format_version: 1, record_count: s.recordCount,
        checksum: s.checksum, payload: s.payload as never, created_by: s.createdBy }).select("id").single();
      if (error || !data) throw new Error("snapshot failed");
      return data.id;
    },
    readSnapshot: async (id) => { const { data } = await db.from("unit_inventory_backups").select("payload").eq("id", id).maybeSingle(); return data ?? null; },
    audit: async (action, metadata) => {
      await db.from("audit_logs").insert({ action, entity_type: "project_unit_backup", entity_id: null, actor_profile_id: c.agentId, actor_label: c.actor, metadata: metadata as never });
    },
  };
  return store;
}
const envName = () => (process.env["SUPABASE_PROJECT_ID"] ?? process.env["VITE_SUPABASE_PROJECT_ID"] ?? "winstone-crm").slice(0, 40);

export const exportUnitBackup = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    if (c.scope !== "authority") throw new Error("Only HQ/IT can export unit backups / শুধু HQ/IT");
    const { exportBackup } = await import("@/lib/unit-backup.server");
    const r = await exportBackup(await backupStore(c), envName(), c.actor);
    return { filename: r.filename, json: JSON.stringify(r.backup, null, 2) };
  });

const MAX_FILE = 5_000_000;
const parseFile = (s: string) => { try { return JSON.parse(s) as unknown; } catch { return undefined; } };

export const previewUnitRestore = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, json: z.string().max(MAX_FILE) }).parse(i))
  .handler(async ({ data }) => {
    const { siCaller, requireAdminWriter } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    requireAdminWriter(c);
    const raw = parseFile(data.json);
    if (raw === undefined) return { ok: false as const, errors: ["File is not valid JSON"] };
    const { previewRestore } = await import("@/lib/unit-backup.server");
    return previewRestore(await backupStore(c), raw);
  });

export const applyUnitRestore = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    adminToken: Token, json: z.string().max(MAX_FILE), filename: z.string().max(200), mode: z.enum(["merge", "full"]),
    overwriteIds: z.array(z.string().uuid()).max(5000), expectedLiveChecksum: z.string().max(100), confirmFull: z.boolean(),
  }).parse(i))
  .handler(async ({ data }) => {
    const { siCaller, requireAdminWriter } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    requireAdminWriter(c);
    const raw = parseFile(data.json);
    const { applyRestore } = await import("@/lib/unit-backup.server");
    return applyRestore(await backupStore(c), { backup: raw ?? null, filename: data.filename, mode: data.mode, overwriteIds: data.overwriteIds,
      expectedLiveChecksum: data.expectedLiveChecksum, confirmFull: data.confirmFull }, c.actor);
  });
