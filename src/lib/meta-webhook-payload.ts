import { z } from "zod";

const id = z.string().regex(/^\d{1,64}$/);
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const message = z.object({
  mid: z.string().min(1).max(256),
  text: z.string().max(20000).optional(),
  is_echo: z.boolean().optional(),
  attachments: z.array(z.object({ type: z.string().min(1).max(64) }).passthrough()).max(20).optional(),
}).passthrough();
const event = z.object({
  sender: z.object({ id }), recipient: z.object({ id }), timestamp,
  message: message.optional(),
  delivery: z.object({ mids: z.array(z.string().min(1).max(256)).min(1).max(100).optional(), watermark: timestamp }).passthrough().optional(),
  read: z.object({ watermark: timestamp }).passthrough().optional(),
  postback: z.object({ title: z.string().max(2000).optional(), payload: z.string().max(2000).optional(), mid: z.string().min(1).max(256).optional() }).passthrough().optional(),
}).passthrough().refine(value => [value.message, value.delivery, value.read, value.postback].filter(Boolean).length === 1);
const envelope = z.object({
  object: z.literal("page"),
  entry: z.array(z.object({ id, time: timestamp, messaging: z.array(event).min(1).max(100) }).passthrough()).min(1).max(50),
}).passthrough().refine(value => value.entry.reduce((sum, entry) => sum + entry.messaging.length, 0) <= 200);

/** Structural validation only. Never establishes Page consent, persistence or delivery. */
export function validateMetaWebhookPayload(value: unknown): { valid: true; eventCount: number } | { valid: false } {
  const parsed = envelope.safeParse(value);
  if (!parsed.success) return { valid: false };
  return { valid: true, eventCount: parsed.data.entry.reduce((sum, entry) => sum + entry.messaging.length, 0) };
}

export function validateMetaWebhookBytes(bytes: Uint8Array) {
  try {
    return validateMetaWebhookPayload(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch { return { valid: false as const }; }
}

/** One normalized event the durable pipeline may store. Page id comes from the envelope, never the sender. */
export type MetaWebhookEvent = {
  pageId: string;
  senderId: string;
  timestamp: number;
  message?: { mid: string; text?: string; isEcho?: boolean };
  delivery?: { watermark: number; mids?: string[] };
  read?: { watermark: number };
  postback?: { title?: string; payload?: string; mid?: string };
};

/** Structural parse only: it never proves Page consent, persistence or delivery. */
export function parseMetaWebhookBytes(bytes: Uint8Array): { ok: true; events: MetaWebhookEvent[] } | { ok: false } {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { return { ok: false }; }
  const parsed = envelope.safeParse(value);
  if (!parsed.success) return { ok: false };
  const events: MetaWebhookEvent[] = [];
  for (const entry of parsed.data.entry) {
    for (const item of entry.messaging) {
      const event: MetaWebhookEvent = { pageId: entry.id, senderId: item.sender.id, timestamp: item.timestamp };
      if (item.message) {
        const message: MetaWebhookEvent["message"] = { mid: item.message.mid };
        if (item.message.text !== undefined) message.text = item.message.text;
        if (item.message.is_echo !== undefined) message.isEcho = item.message.is_echo;
        event.message = message;
      }
      if (item.delivery) {
        const delivery: MetaWebhookEvent["delivery"] = { watermark: item.delivery.watermark };
        if (item.delivery.mids !== undefined) delivery.mids = item.delivery.mids;
        event.delivery = delivery;
      }
      if (item.read) event.read = { watermark: item.read.watermark };
      if (item.postback) {
        const postback: MetaWebhookEvent["postback"] = {};
        if (item.postback.title !== undefined) postback.title = item.postback.title;
        if (item.postback.payload !== undefined) postback.payload = item.postback.payload;
        if (item.postback.mid !== undefined) postback.mid = item.postback.mid;
        event.postback = postback;
      }
      events.push(event);
    }
  }
  return { ok: true, events };
}