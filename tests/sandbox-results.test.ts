import { describe, expect, it } from "vitest";
import { parseSandboxResults } from "@/lib/sandbox-results";
const base = { format: "winstone-sandbox-v1", synthetic: true, checkedAt: 1761700000000, callLogAccess: "granted", calls: [{ type: 2, durationSeconds: 30 }], recording: "local_file_readable", audioDurationMs: 4000, summary: "simulation_saved", summaryText: "x", liveWrites: 0 };
const run = (o: object) => parseSandboxResults(JSON.stringify({ ...base, ...o }));
describe("sandbox results report", () => {
  it("passes when every check passes", () => expect(run({}).overall).toBe("pass"));
  it("fails when call-log access is denied", () => expect(run({ callLogAccess: "denied", calls: [] }).overall).toBe("fail"));
  it("fails when no calls were detected", () => expect(run({ calls: [] }).checks.find(c => c.id === "detection")?.result).toBe("fail"));
  it("fails when the file reports any live CRM write", () => expect(run({ liveWrites: 1 }).overall).toBe("fail"));
  it("marks recording not run when never checked", () => expect(run({ recording: "not_checked" }).overall).toBe("not_run"));
  it("rejects files from another format", () => expect(() => run({ format: "other" })).toThrow());
});
