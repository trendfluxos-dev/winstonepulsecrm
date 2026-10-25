import { describe, expect, it, vi } from "vitest";

import { matchesWebhookSignature, messengerReplyBlock, webhookChallenge } from "@/lib/messenger-protocol.server";
import { filterDemoThreads, messengerView } from "@/lib/messenger-shared";
import { getMessengerService } from "@/lib/messenger.server";

const token = "synthetic-test-token";
const challenge = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": "123456" });
const body = '{"object":"page","entry":[]}';
const secret = "synthetic-unit-test-secret";
async function sign(raw: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return `sha256=${Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

describe("offline Messenger webhook protocol", () => {
  it("validates HMAC against exact raw bytes", async () => {
    const signature = await sign(body);
    expect(await matchesWebhookSignature(body, signature, secret)).toBe(true);
    expect(await matchesWebhookSignature(`${body} `, signature, secret)).toBe(false);
    expect(await matchesWebhookSignature(body, signature, "wrong-secret")).toBe(false);
  });
  it("rejects missing, malformed and empty-key signatures", async () => {
    for (const signature of [null, "", "sha1=abc", "sha256=zz", `sha256=${"0".repeat(64)}`]) {
      expect(await matchesWebhookSignature(body, signature, secret)).toBe(false);
    }
    expect(await matchesWebhookSignature(body, await sign(body), "")).toBe(false);
  });
  it("accepts only exact subscribe challenge with a configured expected token", () => {
    expect(webhookChallenge(challenge, token)).toBe("123456");
    expect(webhookChallenge(challenge, "wrong")).toBeNull();
    expect(webhookChallenge(challenge, "")).toBeNull();
    expect(webhookChallenge(new URLSearchParams(), token)).toBeNull();
  });
  it("refuses ambiguous parameters and non-numeric challenge", () => {
    const duplicate = new URLSearchParams(challenge);
    duplicate.append("hub.verify_token", token);
    expect(webhookChallenge(duplicate, token)).toBeNull();
    const invalid = new URLSearchParams(challenge);
    invalid.set("hub.challenge", "<script>");
    expect(webhookChallenge(invalid, token)).toBeNull();
    invalid.set("hub.mode", "unsubscribe");
    expect(webhookChallenge(invalid, token)).toBeNull();
  });
  it("rejects duplicate mode or challenge even when the first value matches", () => {
    for (const field of ["hub.mode", "hub.challenge"]) {
      const params = new URLSearchParams(challenge);
      params.append(field, params.get(field) ?? "");
      expect(webhookChallenge(params, token)).toBeNull();
    }
  });
  it("bounds the offline numeric challenge without coercing its exact value", () => {
    const params = new URLSearchParams(challenge);
    params.set("hub.challenge", "0".repeat(100));
    expect(webhookChallenge(params, token)).toBe("0".repeat(100));
    params.set("hub.challenge", "1".repeat(101));
    expect(webhookChallenge(params, token)).toBeNull();
    for (const value of ["", " 123", "123\n", "1.5", "-1"]) {
      params.set("hub.challenge", value);
      expect(webhookChallenge(params, token)).toBeNull();
    }
  });
  it("valid protocol inputs cannot enable the adapter or trigger network I/O", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Network prohibited"); });
    try {
      const service = getMessengerService();
      expect(await service.verifyWebhook(challenge)).toEqual({ ok: false, status: 403 });
      expect(await service.ingestWebhook(body, await sign(body))).toEqual({ ok: false, status: 403 });
      for (let i = 0; i < 2; i++) {
        expect(await service.sendReply({ threadId: "demo-1", text: "synthetic", requestId: "same-request" })).toEqual({ ok: false, reason: "FACEBOOK_NOT_CONNECTED" });
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
});

const now = Date.UTC(2026, 9, 24, 12);
const eligible = { connected: true, canReply: true, owned: true, suppressed: false, briefingAcknowledged: true, maintenanceLocked: false, lastInboundAt: now - 60_000, now };
describe("future reply preflight never bypasses gates", () => {
  it("allows only a current owned unsuppressed conversation", () => {
    expect(messengerReplyBlock(eligible)).toBeNull();
  });
  it("blocks other-agent and read-only replies", () => {
    expect(messengerReplyBlock({ ...eligible, owned: false })).toBe("FORBIDDEN");
    expect(messengerReplyBlock({ ...eligible, canReply: false })).toBe("FORBIDDEN");
  });
  it("blocks disconnected Facebook", () => {
    expect(messengerReplyBlock({ ...eligible, connected: false })).toBe("FACEBOOK_NOT_CONNECTED");
  });
  it("keeps the maintenance gate", () => {
    expect(messengerReplyBlock({ ...eligible, maintenanceLocked: true })).toBe("MAINTENANCE_LOCKED");
  });
  it("keeps the briefing gate", () => {
    expect(messengerReplyBlock({ ...eligible, briefingAcknowledged: false })).toBe("BRIEFING_REQUIRED");
  });
  it("blocks do-not-contact customers", () => {
    expect(messengerReplyBlock({ ...eligible, suppressed: true })).toBe("DO_NOT_CONTACT");
  });
  it("closes the window at exactly 24 hours, permits one millisecond before", () => {
    const boundary = now - 24 * 60 * 60 * 1000;
    expect(messengerReplyBlock({ ...eligible, lastInboundAt: boundary })).toBe("MESSAGING_WINDOW_CLOSED");
    expect(messengerReplyBlock({ ...eligible, lastInboundAt: boundary + 1 })).toBeNull();
  });
  it("missing, future and non-finite timestamps fail closed", () => {
    for (const lastInboundAt of [null, NaN, Infinity, now + 1]) {
      expect(messengerReplyBlock({ ...eligible, lastInboundAt })).toBe("MESSAGING_WINDOW_CLOSED");
    }
    expect(messengerReplyBlock({ ...eligible, now: NaN })).toBe("MESSAGING_WINDOW_CLOSED");
  });
});

describe("scoped demo filtering", () => {
  const agent = messengerView({ scope: "agent", readOnly: false });
  it("search cannot reveal other-agent or unassigned threads", () => {
    expect(filterDemoThreads(agent, { queue: "mine", search: "লোকেশন", status: "all" })).toEqual([]);
    expect(filterDemoThreads(agent, { queue: "unassigned", search: "", status: "all" })).toEqual([]);
  });
  it("combines scoped status and search", () => {
    expect(filterDemoThreads(agent, { queue: "mine", search: " ধন্যবাদ ", status: "pending" }).map((thread) => thread.id)).toEqual(["demo-2"]);
    expect(filterDemoThreads(agent, { queue: "mine", search: "ধন্যবাদ", status: "open" })).toEqual([]);
  });
  it("HQ may filter unassigned samples but anonymous callers still see nothing", () => {
    expect(filterDemoThreads(messengerView({ scope: "authority", readOnly: true }), { queue: "unassigned", search: "", status: "open" }).map((thread) => thread.id)).toEqual(["demo-3"]);
    expect(filterDemoThreads(messengerView({ scope: "none", readOnly: true }), { queue: "mine", search: "", status: "all" })).toEqual([]);
  });
});