import { expect, it } from "vitest";
import { inspectSignedWebhook, MAX_WEBHOOK_BYTES } from "@/lib/messenger-webhook.server";
const secret = "synthetic-test-secret";
async function request(body: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const hash = await crypto.subtle.sign("HMAC", key, body);
  const signature = `sha256=${Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("")}`;
  return new Request("http://localhost/webhook", { method: "POST", body: Uint8Array.from(body), headers: { "x-hub-signature-256": signature } });
}
it("valid exact raw bytes never acknowledge unpersisted messages", async () => {
  const body = new TextEncoder().encode(JSON.stringify({ object: "page", entry: [{ id: "0", time: 0, messaging: [{ sender: { id: "0" }, recipient: { id: "0" }, timestamp: 0, message: { mid: "SYNTHETIC_TEST" } }] }] }));
  const response = await inspectSignedWebhook(await request(body), secret);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false, code: "MESSENGER_INGESTION_NOT_READY" });
});
it("rejects signed invalid UTF-8 or payloads after signature verification", async () => {
  for (const bytes of [new Uint8Array([255, 0, 128, 65]), new TextEncoder().encode('{"object":"page","entry":[]}')]) {
    const response = await inspectSignedWebhook(await request(bytes), secret);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "INVALID_WEBHOOK_PAYLOAD" });
  }
});
it("validates signature before attempting to parse a malformed payload", async () => {
  expect((await inspectSignedWebhook(await request(new Uint8Array([255])), "wrong")).status).toBe(401);
});
it("replayed valid signed events remain unaccepted without durable storage", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ object: "page", entry: [{ id: "0", time: 0, messaging: [{ sender: { id: "0" }, recipient: { id: "0" }, timestamp: 0, message: { mid: "REPLAY_SYNTHETIC" } }] }] }));
  for (let i = 0; i < 2; i++) expect((await inspectSignedWebhook(await request(bytes), secret)).status).toBe(503);
});
it("refuses invalid signatures before ingestion", async () => {
  const response = await inspectSignedWebhook(await request(new TextEncoder().encode("synthetic")), "wrong");
  expect(response.status).toBe(401);
  expect((await response.json()).code).toBe("INVALID_WEBHOOK_SIGNATURE");
});
it("bounds signed body to 262144 bytes", async () => {
  expect((await inspectSignedWebhook(await request(new Uint8Array(MAX_WEBHOOK_BYTES + 1)), secret)).status).toBe(413);
});
it("missing server configuration refuses without revealing secrets", async () => {
  const response = await inspectSignedWebhook(await request(new Uint8Array([1])), undefined);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false, code: "FACEBOOK_NOT_CONNECTED" });
});