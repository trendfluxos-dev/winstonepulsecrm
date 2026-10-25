import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  CREDENTIAL_INCIDENT_STATUSES,
  CREDENTIAL_SERVICES,
  latestPerService,
  validateIncidentNote,
  type CredentialIncident,
} from "@/lib/credential-incidents";

const Base = z.object({ adminToken: z.string().nullable().optional() });

const SERVICE_IDS = CREDENTIAL_SERVICES.map((s) => s.id) as [string, ...string[]];
const STATUS_IDS = CREDENTIAL_INCIDENT_STATUSES.map((s) => s.id) as [string, ...string[]];

type IncidentRow = {
  id: string;
  service: string;
  status: string;
  note: string;
  actor_label: string | null;
  created_at: string;
};

const toIncident = (row: IncidentRow): CredentialIncident => ({
  id: row.id,
  service: row.service as CredentialIncident["service"],
  status: row.status as CredentialIncident["status"],
  note: row.note,
  actorLabel: row.actor_label,
  createdAt: row.created_at,
});

/** Staff read of the incident log; newest first, bounded. */
export const listCredentialIncidents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    const { messengerView } = await import("@/lib/messenger-shared");
    if (!messengerView(caller).canOpen) return { ok: false as const, code: "FORBIDDEN" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("credential_incidents")
      .select("id, service, status, note, actor_label, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      if (error.code === "42P01" || error.code === "42703") return { ok: true as const, records: [] as CredentialIncident[] };
      return { ok: false as const, code: "UNAVAILABLE" as const };
    }
    const records = ((rows ?? []) as unknown as IncidentRow[]).map(toIncident);
    return { ok: true as const, records, latest: Object.fromEntries(latestPerService(records)) };
  });

/**
 * Record one credential-incident status. Authority (IT) only; the note is
 * validated so no credential value can be stored. Append-only (the database
 * blocks updates and deletes).
 */
export const recordCredentialIncident = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      service: z.enum(SERVICE_IDS),
      status: z.enum(STATUS_IDS),
      note: z.string().min(1).max(1000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority, requireWrite } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    // Incident records are IT-only audit rows: an ordinary agent session must
    // not be able to write them.
    try {
      requireAuthority(caller);
      requireWrite(caller);
    } catch {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }

    const note = validateIncidentNote(data.note);
    if (!note.ok) return { ok: false as const, code: note.code };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("credential_incidents").insert({
      service: data.service,
      status: data.status,
      note: note.note,
      actor: caller.profile?.id ?? null,
      actor_label: caller.profile?.name ?? caller.label ?? null,
    });
    if (error) {
      if (error.code === "42P01" || error.code === "42703") return { ok: false as const, code: "STORAGE_UNAVAILABLE" as const };
      throw error;
    }
    return { ok: true as const };
  });
