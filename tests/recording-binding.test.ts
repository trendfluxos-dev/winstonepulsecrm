import { describe, expect, it } from "vitest";
import { assertAudioIdentity, recordingBindingError } from "@/lib/call-reconciliation";

describe("recordings stay bound to their agent and call", () => {
  it("phone-recorder audio without a call id is refused", () => {
    expect(recordingBindingError({ recorder_source: "phone_recorder", call_uid: null })).toMatch(/call id/);
    expect(recordingBindingError({ recorder_source: "phone_recorder", call_uid: "  " })).toMatch(/call id/);
    expect(recordingBindingError({ recorder_source: "phone_recorder" })).toMatch(/call id/);
  });
  it("phone-recorder audio with a call id, and app-captured audio, pass this check", () => {
    expect(recordingBindingError({ recorder_source: "phone_recorder", call_uid: "and-abc-1800000000000" })).toBeNull();
    expect(recordingBindingError({ recorder_source: "voice_call", call_uid: null })).toBeNull();
  });
  it("a delayed upload for another agent's or another lead's call is a conflict", () => {
    const row = { agent_id: "agent-a", lead_id: "lead-1", storage_path: null, audio_url: null, checksum: null };
    expect(() => assertAudioIdentity(row, "agent-b", "lead-1", "c")).toThrow("CALL_IDENTITY_CONFLICT");
    expect(() => assertAudioIdentity(row, "agent-a", "lead-2", "c")).toThrow("CALL_IDENTITY_CONFLICT");
    expect(() => assertAudioIdentity(row, "agent-a", "lead-1", "c")).not.toThrow();
  });
});
