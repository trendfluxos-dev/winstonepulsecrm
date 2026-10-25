import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  META_VERIFICATION_TRACKS,
  latestPerTrack,
  validateEvidenceNote,
  type MetaVerificationRecord,
} from "@/lib/meta-verification";

const Base = z.object({ adminToken: z.string().nullable().optional() });

const TRACK_IDS = META_VERIFICATION_TRACKS.map((track) => track.id) as [string, ...string[]];

type RecordRow = {
  id: string;
  track: string;
  outcome: string;
  note: string;
  actor_label: string | null;
  created_at: string;
};

const toRecord = (row: RecordRow): MetaVerificationRecord => ({
  id: row.id,
  track: row.track as MetaVerificationRecord["track"],
  outcome: row.outcome === "failed" ? "failed" : "verified",
  note: row.note,
  actorLabel: row.actor_label,
  createdAt: row.created_at,
});

/** Staff read of the evidence log; newest first, bounded. */
export const listMetaVerification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    const { messengerView } = await import("@/lib/messenger-shared");
    if (!messengerView(caller).canOpen) return { ok: false as const, code: "FORBIDDEN" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("meta_verification_records" as never)
      .select("id, track, outcome, note, actor_label, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      if (error.code === "42P01" || error.code === "42703") return { ok: true as const, records: [] as MetaVerificationRecord[] };
      return { ok: false as const, code: "UNAVAILABLE" as const };
    }
    const records = ((rows ?? []) as unknown as RecordRow[]).map(toRecord);
    return { ok: true as const, records, latest: Object.fromEntries(latestPerTrack(records)) };
  });

/**
 * Record one piece of checklist evidence. Authority (IT) only; the note is
 * validated so no access token can be stored as evidence. Append-only.
 */
export const recordMetaVerification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      track: z.enum(TRACK_IDS),
      outcome: z.enum(["verified", "failed"]),
      note: z.string().min(1).max(1000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority, requireWrite } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    // Verification evidence is an IT-only audit row: an ordinary agent
    // session must not be able to write it.
    try {
      requireAuthority(caller);
      requireWrite(caller);
    } catch {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }

    const note = validateEvidenceNote(data.note);
    if (!note.ok) return { ok: false as const, code: note.code };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("meta_verification_records" as never).insert({
      track: data.track,
      outcome: data.outcome,
      note: note.note,
      actor: caller.profile?.id ?? null,
      actor_label: caller.profile?.name ?? caller.label ?? null,
    } as never);
    if (error) {
      if (error.code === "42P01" || error.code === "42703") return { ok: false as const, code: "STORAGE_UNAVAILABLE" as const };
      throw error;
    }
    return { ok: true as const };
  });
