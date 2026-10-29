import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { MetaVerificationRecord } from "@/lib/meta-verification";
import {
  evaluateSyncEnable,
  validateDecisionReason,
  type MessengerSyncDecision,
} from "@/lib/messenger-sync-decisions";

const Base = z.object({ adminToken: z.string().nullable().optional() });

type DecisionRow = {
  id: string;
  action: string;
  actor_label: string | null;
  verified_tracks: string[] | null;
  missing_tracks: string[] | null;
  reason: string;
  created_at: string;
};

const toDecision = (row: DecisionRow): MessengerSyncDecision => ({
  id: row.id,
  action: row.action === "enable" ? "enable" : "disable",
  actorLabel: row.actor_label,
  verifiedTracks: (row.verified_tracks ?? []) as MessengerSyncDecision["verifiedTracks"],
  missingTracks: (row.missing_tracks ?? []) as MessengerSyncDecision["missingTracks"],
  reason: row.reason,
  createdAt: row.created_at,
});

/** Staff read of the sync decision audit log; newest first, bounded. */
export const listMessengerSyncDecisions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    const { messengerView } = await import("@/lib/messenger-shared");
    if (!messengerView(caller).canOpen) return { ok: false as const, code: "FORBIDDEN" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("messenger_sync_decisions" as never)
      .select("id, action, actor_label, verified_tracks, missing_tracks, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (error.code === "42P01" || error.code === "42703") return { ok: true as const, decisions: [] as MessengerSyncDecision[] };
      return { ok: false as const, code: "UNAVAILABLE" as const };
    }
    const decisions = ((rows ?? []) as unknown as DecisionRow[]).map(toDecision);
    return { ok: true as const, decisions };
  });

/**
 * Record one sync enable/disable decision. Authority (IT) only. An enable
 * decision is refused unless every verification checklist track's latest
 * outcome is "verified"; the verification snapshot is stored with the row so
 * the audit shows exactly what was verified at decision time. Append-only.
 */
export const recordMessengerSyncDecision = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      action: z.enum(["enable", "disable"]),
      reason: z.string().min(1).max(1000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    // Sync decisions need the full IT PIN; a session or HQ PIN is never enough.
    const gate = await import("@/lib/admin-gate.server");
    if (gate.adminTokenScope(data.adminToken ?? null) !== "full") {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }
    const caller = await resolveCaller(data.adminToken ?? null);
    const { messengerView } = await import("@/lib/messenger-shared");
    const view = messengerView(caller);
    if (!view.canOpen || view.readOnly) return { ok: false as const, code: "FORBIDDEN" as const };

    const reason = validateDecisionReason(data.reason);
    if (!reason.ok) return { ok: false as const, code: reason.code };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let verifiedTracks: string[] = [];
    let missingTracks: string[] = [];
    if (data.action === "enable") {
      const { data: evidence, error: evidenceError } = await supabaseAdmin
        .from("meta_verification_records" as never)
        .select("id, track, outcome, note, actor_label, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (evidenceError) return { ok: false as const, code: "UNAVAILABLE" as const };
      const evaluation = evaluateSyncEnable((evidence ?? []) as unknown as MetaVerificationRecord[]);
      if (!evaluation.ok) {
        return { ok: false as const, code: "VERIFICATION_INCOMPLETE" as const, missingTracks: evaluation.missingTracks };
      }
      verifiedTracks = evaluation.verifiedTracks;
    } else {
      // A disable decision still snapshots which tracks were verified.
      const { data: evidence } = await supabaseAdmin
        .from("meta_verification_records" as never)
        .select("id, track, outcome, note, actor_label, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      const evaluation = evaluateSyncEnable((evidence ?? []) as unknown as MetaVerificationRecord[]);
      if (evaluation.ok) verifiedTracks = evaluation.verifiedTracks;
      else missingTracks = evaluation.missingTracks;
    }

    const { error } = await supabaseAdmin.from("messenger_sync_decisions" as never).insert({
      action: data.action,
      actor: caller.profile?.id ?? null,
      actor_label: caller.profile?.name ?? caller.label ?? null,
      verified_tracks: verifiedTracks,
      missing_tracks: missingTracks,
      reason: reason.note,
    } as never);
    if (error) {
      if (error.code === "42P01" || error.code === "42703") return { ok: false as const, code: "STORAGE_UNAVAILABLE" as const };
      throw error;
    }
    return { ok: true as const };
  });
