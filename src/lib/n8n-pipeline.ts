/**
 * n8n → CRM lead pipeline: pure, browser-safe rules. Payload schema, consent
 * purposes, event-key and payload-hash helpers. No database, no env reads —
 * the server route passes everything in.
 */
import { z } from "zod";

export const N8N_MAX_BODY_BYTES = 64 * 1024;
export const N8N_RATE_LIMIT_PER_MINUTE = 120;

/** Purposes an inbound lead may carry consent for. */
export const CONSENT_PURPOSES = ["marketing", "follow_up", "recording"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const n8nLeadPayloadSchema = z
  .object({
    event_id: z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/, "event_id must be a safe idempotency key"),
    name: z.string().min(1).max(200),
    phone: z.string().min(5).max(40),
    source: z.string().min(1).max(100),
    consent_purpose: z.enum(CONSENT_PURPOSES),
    /** The exact notice text the person agreed to — stored as the legal record. */
    consent_text: z.string().min(10).max(1000),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export type N8nLeadPayload = z.infer<typeof n8nLeadPayloadSchema>;

export async function sha256HexText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Retention for pipeline artifacts; consent events are kept permanently. */
export const PIPELINE_BANT_RETENTION_DAYS = 90;
export function pipelineRetentionCutoff(nowMs: number): string {
  return new Date(nowMs - PIPELINE_BANT_RETENTION_DAYS * 86_400_000).toISOString();
}
