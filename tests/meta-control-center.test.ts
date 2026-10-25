import { describe, expect, it, vi } from "vitest";
import { simulateMetaEvent } from "@/lib/meta-control-center";
import { validateMetaWebhookPayload } from "@/lib/meta-webhook-payload";

describe("isolated Meta simulator", () => {
  it("does not create real records or perform network calls", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Network prohibited"); });
    try {
      const first = await simulateMetaEvent("valid", {});
      expect(first.result).toMatchObject({ code: "SIMULATED_NEW_EVENT", realRecordsCreated: 0, simulationOnly: true });
      expect((await simulateMetaEvent("valid", first.ledger)).result.code).toBe("SIMULATED_DUPLICATE");
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it("models duplicate suppression without overwriting receipt fingerprints", async () => {
    const duplicate = await simulateMetaEvent("duplicate", {});
    expect(duplicate.result.code).toBe("SIMULATED_DUPLICATE");
    const conflict = await simulateMetaEvent("conflict", duplicate.ledger);
    expect(conflict.result.code).toBe("SIMULATED_CONFLICT");
    expect(conflict.ledger).toEqual(duplicate.ledger);
  });
  it("rejects simulated invalid signatures before payload or idempotency handling", async () => {
    const result = await simulateMetaEvent("invalid_signature", {});
    expect(result.result.stage).toBe("signature");
    expect(result.result.code).toBe("SIMULATED_INVALID_SIGNATURE");
    expect(result.ledger).toEqual({});
  });
  it("rejects malformed synthetic payloads without receipt creation", async () => {
    const result = await simulateMetaEvent("invalid_payload", {});
    expect(result.result.code).toBe("SIMULATED_INVALID_PAYLOAD");
    expect(result.ledger).toEqual({});
  });
});

const event = { sender: { id: "0" }, recipient: { id: "0" }, timestamp: 0, message: { mid: "SYNTHETIC_VALIDATOR" } };
const envelope = (messaging: unknown[]) => ({ object: "page", entry: [{ id: "0", time: 0, messaging }] });
describe("bounded signed payload structure", () => {
  it("accepts a Page message and returns only event count, never content or IDs", () => {
    expect(validateMetaWebhookPayload(envelope([event]))).toEqual({ valid: true, eventCount: 1 });
  });
  it("rejects wrong objects, empty events and missing message identifiers", () => {
    expect(validateMetaWebhookPayload({ object: "user", entry: [] }).valid).toBe(false);
    expect(validateMetaWebhookPayload(envelope([])).valid).toBe(false);
    expect(validateMetaWebhookPayload(envelope([{ ...event, message: {} }])).valid).toBe(false);
  });
  it("bounds event batches and message text", () => {
    expect(validateMetaWebhookPayload(envelope(Array(101).fill(event))).valid).toBe(false);
    expect(validateMetaWebhookPayload(envelope([{ ...event, message: { mid: "SYNTHETIC", text: "x".repeat(20001) } }])).valid).toBe(false);
    expect(validateMetaWebhookPayload({ object: "page", entry: Array(3).fill({ id: "0", time: 0, messaging: Array(100).fill(event) }) }).valid).toBe(false);
  });
  it("refuses ambiguous or unsupported event types", () => {
    expect(validateMetaWebhookPayload(envelope([{ ...event, read: { watermark: 0 } }])).valid).toBe(false);
    expect(validateMetaWebhookPayload(envelope([{ sender: { id: "0" }, recipient: { id: "0" }, timestamp: 0, unknown: true }])).valid).toBe(false);
  });
});