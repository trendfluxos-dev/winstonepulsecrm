import { describe, expect, it } from "vitest";
import { callSyncState, classifySyncFailure, reconcileCalls, redactDiagnostic } from "@/lib/sync-diagnostics";

describe("privacy-safe diagnostics", () => {
  it("drops call content and personal data, fingerprints identifiers", async () => {
    const safe = await redactDiagnostic({
      stage: "audio_upload", callUid: "call-123", checksum: "abcdef0123", httpStatus: 409, attempt: 3,
      fileBytes: 250_000, mimeType: "audio/mp4", manufacturer: "Xiaomi", osVersion: "14",
      phone: "01805049666", transcript: "আমি প্লট চাই", customerName: "Rahim", token: "secret-token", audioUrl: "https://x/a.m4a",
    });
    const text = JSON.stringify(safe);
    for (const leaked of ["01805049666", "প্লট", "Rahim", "secret-token", "a.m4a", "call-123", "abcdef0123"]) expect(text).not.toContain(leaked);
    expect(safe.callRef).toMatch(/^[0-9a-f]{12}$/);
    expect(safe.sizeBucket).toBe("<1MB");
    expect(safe.reason).toBe("lifecycle_not_synced");
    expect(Object.keys(safe).sort()).toEqual(["at", "attempt", "callRef", "checksumRef", "httpStatus", "manufacturer", "mimeType", "osVersion", "permissionGranted", "reason", "sizeBucket", "stage"]);
  });
  it("same call gives the same fingerprint for cross-device investigation", async () => {
    const a = await redactDiagnostic({ stage: "report_open", callUid: "u1" });
    const b = await redactDiagnostic({ stage: "audio_upload", callUid: "u1" });
    expect(a.callRef).toBe(b.callRef);
  });
  it("rejects non-audio mime and caps attempts", async () => {
    const s = await redactDiagnostic({ stage: "audio_upload", mimeType: "text/html<script>", attempt: 5000 });
    expect(s.mimeType).toBeNull();
    expect(s.attempt).toBe(99);
  });
});

describe("clear retry failure reasons", () => {
  it.each([
    [{ permissionGranted: false }, "permission_denied", true],
    [{ httpStatus: 401 }, "auth_expired", true],
    [{ httpStatus: 409 }, "lifecycle_not_synced", true],
    [{ httpStatus: 429 }, "rate_limited", true],
    [{ httpStatus: 503 }, "server_error", true],
    [{ httpStatus: 0 }, "offline", true],
    [{ errorCode: "CALL_IDENTITY_CONFLICT", httpStatus: 409 }, "identity_conflict", false],
    [{ errorCode: "AUDIO_CHECKSUM_CONFLICT" }, "checksum_conflict", false],
    [{ errorCode: "NO_MATCHING_RECORDING" }, "no_matching_recording", true],
  ] as const)("%o → %s", (input, reason, retryable) => {
    const r = classifySyncFailure(input);
    expect(r.reason).toBe(reason);
    expect(r.retryable).toBe(retryable);
    expect(r.bn.length).toBeGreaterThan(0);
  });
  it("auth failures never become success — retry requires signing in again", () => {
    expect(classifySyncFailure({ httpStatus: 403 }).reason).not.toBe("ok");
  });
});

describe("pending until server confirmation; report vs audio are separate", () => {
  const ack = { recording_id: "r1", upload_status: "uploaded", checksum: "h" };
  it("report synced does not make audio stored", () => {
    const s = callSyncState({ reportSubmittedAck: true, audioExpected: true, expectedChecksum: "h", uploadAck: null });
    expect(s).toEqual({ report: "synced", audio: "pending", keepOriginalOnPhone: true });
  });
  it("audio stored only on matching ack; report may still be pending", () => {
    expect(callSyncState({ reportSubmittedAck: false, audioExpected: true, expectedChecksum: "h", uploadAck: ack }))
      .toEqual({ report: "pending", audio: "stored", keepOriginalOnPhone: false });
  });
  it("mismatched checksum, verified-by-analysis or missing expected checksum stays pending", () => {
    for (const uploadAck of [{ ...ack, checksum: "x" }, { ...ack, upload_status: "verified" }, { ...ack, recording_id: "" }])
      expect(callSyncState({ reportSubmittedAck: true, audioExpected: true, expectedChecksum: "h", uploadAck }).audio).toBe("pending");
    expect(callSyncState({ reportSubmittedAck: true, audioExpected: true, expectedChecksum: null, uploadAck: ack }).keepOriginalOnPhone).toBe(true);
  });
  it("failed upload keeps the original on the phone", () => {
    expect(callSyncState({ reportSubmittedAck: true, audioExpected: true, expectedChecksum: "h", audioError: true }))
      .toMatchObject({ audio: "failed", keepOriginalOnPhone: true });
  });
});

describe("idempotent call-ID reconciliation", () => {
  const base = { agentId: "a1", leadId: "l1" };
  it("report, upload and CRM row for one call merge into one record; replays do not duplicate", () => {
    const ev = [
      { ...base, callUid: "c1", source: "android_report" as const, reportId: "rep1" },
      { ...base, callUid: "c1", source: "recording_upload" as const, recordingId: "rec1", checksum: "h" },
      { ...base, callUid: "c1", source: "crm_record" as const, recordingId: "rec1", reportId: "rep1", checksum: "h" },
      { ...base, callUid: "c1", source: "recording_upload" as const, recordingId: "rec1", checksum: "h" },
    ];
    const once = reconcileCalls(ev);
    expect(once).toHaveLength(1);
    expect(once[0]).toMatchObject({ recordingId: "rec1", reportId: "rep1", checksum: "h", conflicts: [] });
    expect(reconcileCalls([...ev, ...ev])).toEqual(once);
  });
  it("different calls stay separate even with the same lead", () => {
    expect(reconcileCalls([
      { ...base, callUid: "c1", source: "android_report" },
      { ...base, callUid: "c2", source: "android_report" },
    ])).toHaveLength(2);
  });
  it("conflicting agent, lead or audio is flagged, never overwritten", () => {
    const [r] = reconcileCalls([
      { ...base, callUid: "c1", source: "recording_upload", recordingId: "rec1", checksum: "h" },
      { agentId: "a2", leadId: "l2", callUid: "c1", source: "crm_record", recordingId: "rec9", checksum: "z" },
    ]);
    expect(r.agentId).toBe("a1");
    expect(r.recordingId).toBe("rec1");
    expect(r.conflicts.sort()).toEqual(["agent", "checksum", "lead", "recording"]);
  });
  it("blank call IDs are ignored rather than merged together", () => {
    expect(reconcileCalls([{ ...base, callUid: " ", source: "android_report" }])).toEqual([]);
  });
});
