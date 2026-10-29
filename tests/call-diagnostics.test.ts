import { expect, it } from "vitest";
import { recordingEvidence, summaryEvidence } from "../src/lib/call-diagnostics";
it("does not call a file reference a confirmed upload", () => expect(recordingEvidence({ storage_path: "file", upload_status: "pending", file_size_bytes: 100 })).toBe("file_reference_only"));
it("requires upload and nonempty file evidence", () => expect(recordingEvidence({ storage_path: "file", upload_status: "uploaded", file_size_bytes: 100 })).toBe("upload_recorded"));
it("no file is not invented audio", () => expect(recordingEvidence({ storage_path: null, upload_status: "uploaded", file_size_bytes: 0 })).toBe("no_file_recorded"));
it("completed analysis without a saved summary is not ready", () => expect(summaryEvidence({ analysis_status: "completed", ai_summary: null })).toBe("not_saved"));
it("saved summary is authoritative", () => expect(summaryEvidence({ analysis_status: "completed", ai_summary: "Saved facts" })).toBe("saved"));
it("processing and failed stay distinct", () => { expect(summaryEvidence({ analysis_status: "processing", ai_summary: null })).toBe("processing"); expect(summaryEvidence({ analysis_status: "failed", ai_summary: null })).toBe("failed"); });