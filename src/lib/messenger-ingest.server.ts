/**
 * Durable Messenger webhook ingestion.
 *
 * Order is fixed: exact raw-byte signature first, strict payload parse second,
 * atomic per-event receipt third, message storage last. Every stage fails
 * closed — a valid signature is never treated as Page consent, and nothing is
 * acknowledged as stored until a row actually exists.
 *
 * The pipeline stays switched off until the reviewed storage migration is
 * applied and Meta App/Page approvals are verified, so the running app keeps
 * refusing real events instead of pretending to accept them.
 */
import { matchesWebhookSignature } from "@/lib/messenger-protocol.server";
import { parseMetaWebhookBytes, type MetaWebhookEvent } from "@/lib/meta-webhook-payload";

export const MAX_WEBHOOK_BYTES = 262144;
/** Server-only switch; absent or any other value keeps ingestion refused. */
export const MESSENGER_INGESTION_FLAG = "MESSENGER_INGESTION_ENABLED";

export function messengerIngestionEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[MESSENGER_INGESTION_FLAG] === "true";
}

export type ReceiptClaim =
  | { kind: "fresh" }
  | { kind: "duplicate" }
  | { kind: "conflict" }
  | { kind: "storage_unavailable" };

export type StoredInbound =
  | { ok: true; threadId: string; messageId: string }
  | { ok: false; reason: "storage_unavailable" | "duplicate" };

/** Server-only durable store. Browser code must never implement or reach it. */
export interface MessengerStore {
  claimReceipt(eventKey: string, payloadHash: string): Promise<ReceiptClaim>;
  recordInbound(input: { pageId: string; psid: string; mid: string; text: string | null; timestamp: number }): Promise<StoredInbound>;
  recordStatus(input: {
    pageId: string;
    psid: string;
    kind: "delivery" | "read" | "postback" | "echo";
    eventKey: string;
    timestamp: number;
  }): Promise<{ ok: boolean }>;
}

export type MessengerIngestOutcome =
  | { ok: true; stored: number; duplicates: number }
  | { ok: false; status: number; code: string };

const refusal = (status: number, code: string): MessengerIngestOutcome => ({ ok: false, status, code });

/** Deterministic identity for one event: the same message twice claims the same key. */
export function messengerEventKey(event: MetaWebhookEvent): string {
  if (event.message) return `msg:${event.pageId}:${event.message.mid}`;
  if (event.delivery) return `dlv:${event.pageId}:${event.delivery.watermark}`;
  if (event.read) return `rd:${event.pageId}:${event.read.watermark}`;
  if (event.postback?.mid) return `pbk:${event.pageId}:${event.postback.mid}`;
  return `pbk:${event.pageId}:anon`;
}

/** SHA-256 over a key-sorted rendering, so field order cannot fake a new event. */
export async function messengerPayloadHash(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${canonicalJson(v)}`).join(",")}}`;
}

/** Full durable pipeline. The caller must already have read the raw body within the size bound. */
export async function ingestMessengerWebhook(input: {
  bytes: Uint8Array;
  signature: string | null;
  appSecret: string | undefined;
  store?: MessengerStore;
  enabled?: boolean;
}): Promise<MessengerIngestOutcome> {
  if (!input.appSecret) return refusal(503, "FACEBOOK_NOT_CONNECTED");
  const signature = input.signature;
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return refusal(401, "INVALID_WEBHOOK_SIGNATURE");
  if (!await matchesWebhookSignature(input.bytes, signature, input.appSecret)) return refusal(401, "INVALID_WEBHOOK_SIGNATURE");

  const parsed = parseMetaWebhookBytes(input.bytes);
  if (!parsed.ok) return refusal(400, "INVALID_WEBHOOK_PAYLOAD");

  // Durable storage and Meta approvals are unverified: refuse before any write.
  if (input.enabled ?? !messengerIngestionEnabled()) return refusal(503, "MESSENGER_INGESTION_NOT_READY");

  const store = input.store ?? (await import("@/lib/messenger-store.server")).supabaseMessengerStore();
  let stored = 0;
  let duplicates = 0;

  for (const event of parsed.events) {
    const eventKey = messengerEventKey(event);
    const payloadHash = await messengerPayloadHash(event);
    const claim = await store.claimReceipt(eventKey, payloadHash);
    if (claim.kind === "storage_unavailable") return refusal(503, "MESSENGER_INGESTION_NOT_READY");
    if (claim.kind === "conflict") return refusal(409, "MESSENGER_EVENT_CONFLICT");
    if (claim.kind === "duplicate") {
      duplicates += 1;
      continue;
    }

    if (event.message && !event.message.isEcho) {
      const saved = await store.recordInbound({
        pageId: event.pageId,
        psid: event.senderId,
        mid: event.message.mid,
        text: event.message.text ?? null,
        timestamp: event.timestamp,
      });
      if (!saved.ok) {
        if (saved.reason === "storage_unavailable") return refusal(503, "MESSENGER_INGESTION_NOT_READY");
        duplicates += 1;
        continue;
      }
      stored += 1;
      continue;
    }

    const kind = event.message ? "echo" : event.delivery ? "delivery" : event.read ? "read" : "postback";
    const status = await store.recordStatus({
      pageId: event.pageId,
      psid: event.senderId,
      kind,
      eventKey,
      timestamp: event.timestamp,
    });
    if (!status.ok) return refusal(503, "MESSENGER_INGESTION_NOT_READY");
  }

  return { ok: true, stored, duplicates };
}
