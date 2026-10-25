import { describe, expect, it } from "vitest";
import {
  CONSENT_PURPOSES,
  N8N_MAX_BODY_BYTES,
  N8N_RATE_LIMIT_PER_MINUTE,
  n8nLeadPayloadSchema,
  pipelineRetentionCutoff,
  sha256HexText,
} from "@/lib/n8n-pipeline";
import { verifyOsRequest, hmacHex } from "@/lib/os-bridge";

const validPayload = {
  event_id: "n8n-run-0001:lead-1",
  name: "Rahim Uddin",
  phone: "+8801712345678",
  source: "facebook-form",
  consent_purpose: "marketing" as const,
  consent_text: "I agree to be contacted about Winstone properties.",
  notes: "Asked about Uttara plots",
};

describe("n8n lead payload schema", () => {
  it("accepts a complete synthetic payload", () => {
    expect(n8nLeadPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it("requires an explicit consent purpose and notice text", () => {
    expect(
      n8nLeadPayloadSchema.safeParse({ ...validPayload, consent_purpose: "everything" }).success,
    ).toBe(false);
    expect(
      n8nLeadPayloadSchema.safeParse({ ...validPayload, consent_text: "ok" }).success,
    ).toBe(false);
    expect(CONSENT_PURPOSES).toEqual(["marketing", "follow_up", "recording"]);
  });

  it("rejects missing phone, unsafe event ids and extra fields", () => {
    expect(n8nLeadPayloadSchema.safeParse({ ...validPayload, phone: "" }).success).toBe(false);
    expect(
      n8nLeadPayloadSchema.safeParse({ ...validPayload, event_id: "bad key!" }).success,
    ).toBe(false);
    expect(
      n8nLeadPayloadSchema.safeParse({ ...validPayload, hack: true }).success,
    ).toBe(false);
  });
});

describe("n8n webhook authentication (reuses the signed-request rules)", () => {
  const secret = "test-secret";
  const rawBody = JSON.stringify(validPayload);
  const now = 1_700_000_000;

  const sign = async (body: string, ts: string) => hmacHex(secret, `${ts}.${body}`);

  it("accepts a correctly signed, fresh, idempotent request", async () => {
    const ts = String(now);
    const failure = await verifyOsRequest({
      secret,
      rawBody,
      timestamp: ts,
      signature: await sign(rawBody, ts),
      idempotencyKey: validPayload.event_id,
      nowSeconds: now,
    });
    expect(failure).toBeNull();
  });

  it("rejects a tampered body, a stale timestamp and a reused key shape", async () => {
    const ts = String(now);
    const good = await sign(rawBody, ts);
    expect(
      await verifyOsRequest({
        secret,
        rawBody: rawBody.replace("Rahim", "Karim"),
        timestamp: ts,
        signature: good,
        idempotencyKey: validPayload.event_id,
        nowSeconds: now,
      }),
    ).toBe("invalid_signature");
    expect(
      await verifyOsRequest({
        secret,
        rawBody,
        timestamp: String(now - 1000),
        signature: good,
        idempotencyKey: validPayload.event_id,
        nowSeconds: now,
      }),
    ).toBe("stale_timestamp");
    expect(
      await verifyOsRequest({
        secret,
        rawBody,
        timestamp: ts,
        signature: good,
        idempotencyKey: "short",
        nowSeconds: now,
      }),
    ).toBe("invalid_idempotency_key");
  });
});

describe("pipeline limits and retention", () => {
  it("caps body size and rate", () => {
    expect(N8N_MAX_BODY_BYTES).toBe(64 * 1024);
    expect(N8N_RATE_LIMIT_PER_MINUTE).toBe(120);
  });

  it("hashes payloads deterministically for duplicate detection", async () => {
    const a = await sha256HexText("hello");
    const b = await sha256HexText("hello");
    const c = await sha256HexText("world");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retains BANT payloads for 90 days", () => {
    const now = Date.parse("2026-10-25T00:00:00Z");
    expect(pipelineRetentionCutoff(now)).toBe("2026-07-27T00:00:00.000Z");
  });
});
