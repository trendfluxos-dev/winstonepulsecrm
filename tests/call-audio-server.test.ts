import { beforeEach, describe, expect, it, vi } from "vitest";
import { audioChecksum } from "@/lib/call-reconciliation";
const m = vi.hoisted(() => ({ recording: null as Record<string, unknown> | null, uploads: 0, writes: [] as string[] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: (table: string) => {
    let values: Record<string, unknown> | null = null;
    const b: Record<string, (...args: any[]) => any> = {};
    for (const key of ["select", "eq", "is", "limit"]) b[key] = () => b;
    b.update = b.insert = (v: Record<string, unknown>) => { values = v; m.writes.push(table); return b; };
    b.maybeSingle = async () => ({ data: m.recording, error: null });
    b.single = async () => ({ data: table === "leads" ? { id: "l", assigned_to: "a", phone_number: "01805049666" } : { id: "r" }, error: null });
    b.then = (resolve: (v: unknown) => void) => resolve({ data: values ? [{ id: "r" }] : [], error: null });
    return b;
  }, storage: { from: () => ({ upload: async () => { m.uploads++; return { error: null }; } }) },
} }));
vi.mock("@/lib/call-jobs.server", () => ({ queueCallJobs: async () => {} }));
import { ingestRecording } from "@/lib/call-intel.server";
const bytes = new TextEncoder().encode("ID3genuine-test-container");
const input = { leadId: "l", agentId: "a", audioBase64: btoa(String.fromCharCode(...bytes)), fileExtension: "mp3", durationSeconds: 20, direction: "outgoing" as const, isTwoSided: false, callUid: "physical-call-1", clientUploadId: "audio-physical-call-1" };
beforeEach(() => { m.recording = null; m.uploads = 0; m.writes = []; });
describe("audio upload server reconciliation (in memory)", () => {
  it("same call and checksum return original row without another upload or dial mutation", async () => {
    m.recording = { id: "r", agent_id: "a", lead_id: "l", storage_path: "audio", audio_url: "audio", checksum: await audioChecksum(bytes), upload_status: "uploaded" };
    expect(await ingestRecording(input)).toBe("r");
    expect(await ingestRecording(input)).toBe("r");
    expect(m.uploads).toBe(0); expect(m.writes).toEqual([]);
  });
  it("changed bytes on a reused ID fail before upload", async () => {
    m.recording = { id: "r", agent_id: "a", lead_id: "l", storage_path: "audio", checksum: "different", upload_status: "uploaded" };
    await expect(ingestRecording(input)).rejects.toThrow("AUDIO_CHECKSUM_CONFLICT");
    expect(m.uploads).toBe(0);
  });
  it("wrong agent cannot read/reuse another call upload", async () => {
    m.recording = { id: "r", agent_id: "other", lead_id: "l" };
    await expect(ingestRecording(input)).rejects.toThrow("CALL_IDENTITY_CONFLICT");
    expect(m.writes).toEqual([]);
  });
  it("fills the existing lifecycle row, never creates a new dial or premature verified state", async () => {
    m.recording = { id: "r", agent_id: "a", lead_id: "l", storage_path: null, audio_url: null, upload_status: "pending", call_status: "completed" };
    expect(await ingestRecording(input)).toBe("r");
    expect(m.uploads).toBe(1); expect(m.writes).toEqual(["call_recordings"]);
  });
});