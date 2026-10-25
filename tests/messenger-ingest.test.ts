import { expect, it } from "vitest";
import { ingestMessengerWebhook, messengerEventKey, messengerPayloadHash, type MessengerStore, type ReceiptClaim } from "@/lib/messenger-ingest.server";

const secret = "synthetic-test-secret";

async function signed(body: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const hash = await crypto.subtle.sign("HMAC", key, body);
  return `sha256=${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function bodyOf(message: Record<string, unknown>, pageId = "1381455345040362") {
  return new TextEncoder().encode(
    JSON.stringify({ object: "page", entry: [{ id: pageId, time: 0, messaging: [{ sender: { id: "9007199254740991" }, recipient: { id: pageId }, timestamp: 1764000000000, ...message }] }] }),
  );
}

type Recorded = { pageId: string; psid: string; mid: string; text: string | null };

function fakeStore(claims: ReceiptClaim[]) {
  const seen: Recorded[] = [];
  const store: MessengerStore = {
    claimReceipt: async () => claims.shift() ?? { kind: "duplicate" },
    recordInbound: async (input) => {
      seen.push({ pageId: input.pageId, psid: input.psid, mid: input.mid, text: input.text });
      return { ok: true, threadId: "thread-1", messageId: "message-1" };
    },
    recordStatus: async () => ({ ok: true }),
  };
  return { store, seen };
}

it("stores a genuinely signed new message through the durable store", async () => {
  const body = bodyOf({ message: { mid: "MID_NEW_1", text: "প্লটের দাম কত?" } });
  const { store, seen } = fakeStore([{ kind: "fresh" }]);
  const result = await ingestMessengerWebhook({ bytes: body, signature: await signed(body), appSecret: secret, store, enabled: true });
  expect(result).toEqual({ ok: true, stored: 1, duplicates: 0 });
  expect(seen).toHaveLength(1);
  expect(seen[0].mid).toBe("MID_NEW_1");
  expect(seen[0].text).toBe("প্লটের দাম কত?");
});

it("replays an identical event without storing it twice", async () => {
  const body = bodyOf({ message: { mid: "MID_REPLAY", text: "একই বার্তা" } });
  const { store, seen } = fakeStore([{ kind: "fresh" }, { kind: "duplicate" }]);
  const first = await ingestMessengerWebhook({ bytes: body, signature: await signed(body), appSecret: secret, store, enabled: true });
  const second = await ingestMessengerWebhook({ bytes: body, signature: await signed(body), appSecret: secret, store, enabled: true });
  expect(first).toEqual({ ok: true, stored: 1, duplicates: 0 });
  expect(second).toEqual({ ok: true, stored: 0, duplicates: 1 });
  expect(seen).toHaveLength(1);
});

it("rejects a changed payload that reuses the same event identity", async () => {
  const key = "msg:1381455345040362:MID_TAMPER";
  expect(messengerEventKey({ pageId: "1381455345040362", senderId: "1", timestamp: 0, message: { mid: "MID_TAMPER", text: "আগে" } })).toBe(key);
  const body = bodyOf({ message: { mid: "MID_TAMPER", text: "পরে বদলানো" } });
  const { store, seen } = fakeStore([{ kind: "conflict" }]);
  const result = await ingestMessengerWebhook({ bytes: body, signature: await signed(body), appSecret: secret, store, enabled: true });
  expect(result).toEqual({ ok: false, status: 409, code: "MESSENGER_EVENT_CONFLICT" });
  expect(seen).toHaveLength(0);
});

it("refuses while durable storage is absent instead of acknowledging", async () => {
  const body = bodyOf({ message: { mid: "MID_NO_TABLES", text: "সংরক্ষণ নাই" } });
  const { store, seen } = fakeStore([{ kind: "storage_unavailable" }]);
  const result = await ingestMessengerWebhook({ bytes: body, signature: await signed(body), appSecret: secret, store, enabled: true });
  expect(result).toEqual({ ok: false, status: 503, code: "MESSENGER_INGESTION_NOT_READY" });
  expect(seen).toHaveLength(0);
});

it("stays switched off when the server flag is absent", async () => {
  const body = bodyOf({ message: { mid: "MID_DISABLED", text: "বন্ধ" } });
  const { store, seen } = fakeStore([{ kind: "fresh" }]);
  const result = await ingestMessengerWebhook({ bytes: body, signature: await signed(body), appSecret: secret, store, enabled: false });
  expect(result).toEqual({ ok: false, status: 503, code: "MESSENGER_INGESTION_NOT_READY" });
  expect(seen).toHaveLength(0);
});

it("checks the signature before touching the store", async () => {
  const body = bodyOf({ message: { mid: "MID_UNSIGNED", text: "স্বাক্ষর নাই" } });
  const { store, seen } = fakeStore([{ kind: "fresh" }]);
  const result = await ingestMessengerWebhook({ bytes: body, signature: "sha256=" + "0".repeat(64), appSecret: secret, store, enabled: true });
  expect(result).toEqual({ ok: false, status: 401, code: "INVALID_WEBHOOK_SIGNATURE" });
  expect(seen).toHaveLength(0);
});

it("never stores an echo as a new customer message", async () => {
  const body = bodyOf({ message: { mid: "MID_ECHO", text: "এজেন্টের উত্তর", is_echo: true } });
  const { store, seen } = fakeStore([{ kind: "fresh" }]);
  const result = await ingestMessengerWebhook({ bytes: body, signature: await signed(body), appSecret: secret, store, enabled: true });
  expect(result).toEqual({ ok: true, stored: 0, duplicates: 0 });
  expect(seen).toHaveLength(0);
});

it("keys delivery, read and postback events separately from messages", async () => {
  const base = { pageId: "0", senderId: "1", timestamp: 0 };
  expect(messengerEventKey({ ...base, delivery: { watermark: 42 } })).toBe("dlv:0:42");
  expect(messengerEventKey({ ...base, read: { watermark: 42 } })).toBe("rd:0:42");
  expect(messengerEventKey({ ...base, postback: { mid: "PB1" } })).toBe("pbk:0:PB1");
  expect(messengerEventKey({ ...base, message: { mid: "M1" } })).toBe("msg:0:M1");
});

it("hashes identical content the same whatever field order", async () => {
  const a = await messengerPayloadHash({ b: 1, a: { y: 2, x: 3 } });
  const b = await messengerPayloadHash({ a: { x: 3, y: 2 }, b: 1 });
  const c = await messengerPayloadHash({ b: 1, a: { x: 3, y: 9 } });
  expect(a).toBe(b);
  expect(a).not.toBe(c);
});
