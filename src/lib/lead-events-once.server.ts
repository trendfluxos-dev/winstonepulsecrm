/**
 * Call-history entries that must appear once per physical call, even when the
 * phone retries the same request (offline replay, WorkManager retry, lost
 * response). The marker is a sync_events row with a stable idempotency key
 * (`lead_event:<call-or-recording id>:<kind>`), so no schema change is needed.
 *
 * Order: check marker → write the history entry → write the marker. A failed
 * history write leaves no marker, so the retry writes it; it is never lost.
 */
import type { LeadEventKind } from "@/lib/lead-events.server";

export async function logLeadEventOnce(input: {
  /** Stable id of the physical call or stored recording. */
  onceKey: string;
  leadId: string | null;
  agentId?: string | null;
  deviceId?: string | null;
  recordingId?: string | null;
  kind: LeadEventKind;
  detail?: string | null;
}): Promise<{ logged: boolean }> {
  if (!input.leadId || !input.onceKey) return { logged: false };
  const idempotencyKey = `lead_event:${input.onceKey}:${input.kind}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: prior, error } = await supabaseAdmin
    .from("sync_events")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  // If the marker cannot be read, skip rather than risk a duplicate entry.
  if (error || prior) return { logged: false };

  const { logLeadEvent } = await import("@/lib/lead-events.server");
  await logLeadEvent({
    leadId: input.leadId,
    agentId: input.agentId ?? null,
    recordingId: input.recordingId ?? null,
    kind: input.kind,
    detail: input.detail ?? null,
  });
  const { recordSyncEvent } = await import("@/lib/call-jobs.server");
  await recordSyncEvent({
    agentId: input.agentId ?? null,
    deviceId: input.deviceId ?? null,
    eventType: `lead_event_${input.kind}`,
    entityType: "lead",
    entityId: input.leadId,
    idempotencyKey,
    payload: { kind: input.kind },
  });
  return { logged: true };
}
