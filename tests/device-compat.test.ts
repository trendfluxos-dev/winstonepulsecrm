import { describe, expect, it } from "vitest";
import { buildCompatibilityReport } from "@/lib/call-diagnostics";
const dev = (id: string, model: string, v: string) => ({ id, manufacturer: "Samsung", model, android_version: v, recording_capable: true, recording_tested: false });
const call = (device_id: string, uploaded: boolean, summary: string | null, status = "done") => ({ device_id, storage_path: uploaded ? "p" : null, upload_status: uploaded ? "uploaded" : "pending", file_size_bytes: uploaded ? 10 : null, analysis_status: status, ai_summary: summary });
describe("device compatibility report", () => {
  it("groups two phones of the same model and Android version into one row", () => {
    const rows = buildCompatibilityReport([dev("a", "A15", "14"), dev("b", "A15", "14"), dev("c", "A15", "13")], []);
    expect(rows.map(r => [r.androidVersion, r.devices])).toEqual([["13", 1], ["14", 2]]);
  });
  it("counts detection, confirmed recording and saved summary separately", () => {
    const [r] = buildCompatibilityReport([dev("a", "A15", "14")], [call("a", true, "ok"), call("a", true, null, "failed"), call("a", false, null)]);
    expect([r.callsDetected, r.recordingsUploaded, r.summariesSaved, r.summariesFailed, r.recordingRate, r.summaryRate]).toEqual([3, 2, 1, 1, 67, 50]);
  });
  it("shows no rate when a phone has no calls and ignores calls from unknown phones", () => {
    const [r] = buildCompatibilityReport([dev("a", "A15", "14")], [call("zzz", true, "ok")]);
    expect([r.callsDetected, r.recordingRate, r.summaryRate]).toEqual([0, null, null]);
  });
});
