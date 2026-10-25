/**
 * n8n → CRM lead pipeline (server-only). Durable idempotency via
 * n8n_event_receipts, canonical dedupe via intakeLead (leads always land
 * unassigned for LeadHub Nexus), and an append-only consent record for every
 * accepted payload. Never writes outside the canonical intake path.
 */
import { InvalidLeadPhoneError, intakeLead } from "@/lib/lead-intake.server";
import { sha256HexText, type N8nLeadPayload } from "@/lib/n8n-pipeline";

type AdminClient = Awaited<ReturnType<typeof loadAdmin>>;

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type ReceiptClaim = "claimed" | "duplicate" | "conflict";

/** Claim the idempotency receipt before doing any work. */
export async function claimN8nReceipt(input: {
  admin: AdminClient;
  eventKey: string;
  rawBody: string;
}): Promise<ReceiptClaim> {
  const payloadHash = await sha256HexText(input.rawBody);
  const { error } = await input.admin
    .from("n8n_event_receipts")
    .insert({ event_key: input.eventKey, payload_sha256: payloadHash });
  if (!error) return "claimed";
  if (error.code === "23505") {
    const { data } = await input.admin
      .from("n8n_event_receipts")
      .select("payload_sha256")
      .eq("event_key", input.eventKey)
      .maybeSingle();
    return data && data.payload_sha256 === payloadHash ? "duplicate" : "conflict";
  }
  throw new Error(`n8n receipt claim failed: ${error.message}`);
}

export type PipelineOutcome =
  | { ok: true; leadId: string; duplicate: boolean }
  | { ok: false; code: "INVALID_PHONE" | "INTAKE_FAILED"; reason: string };

/**
 * Store one verified n8n lead: canonical intake (unassigned), then the
 * append-only consent record. Scoring happens separately so a scoring
 * failure can never lose a lead.
 */
export async function processN8nLead(input: {
  admin: AdminClient;
  payload: N8nLeadPayload;
}): Promise<PipelineOutcome> {
  const { payload } = input;
  let leadId: string;
  let duplicate = false;
  try {
    const result = await intakeLead({
      name: payload.name,
      phoneNumber: payload.phone,
      ownerId: null,
      notes: payload.notes ?? null,
      source: `n8n:${payload.source}`,
      actorLabel: "n8n pipeline",
    });
    leadId = result.leadId;
    duplicate = result.duplicate;
  } catch (error) {
    if (error instanceof InvalidLeadPhoneError) {
      return { ok: false, code: "INVALID_PHONE", reason: error.message };
    }
    return { ok: false, code: "INTAKE_FAILED", reason: error instanceof Error ? error.message : "unknown" };
  }

  const { error } = await input.admin.from("lead_consent_events").insert({
    phone: payload.phone,
    lead_id: leadId,
    purpose: payload.consent_purpose,
    action: "granted",
    source: `n8n:${payload.source}`,
    consent_text: payload.consent_text,
    actor_label: "n8n pipeline",
  });
  if (error) throw new Error(`consent record failed: ${error.message}`);

  return { ok: true, leadId, duplicate };
}
