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
  const response = await inspectSignedWebhook(await request(new Uint8Array([255, 0, 128, 65])), secret);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false, code: "MESSENGER_INGESTION_NOT_READY" });
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