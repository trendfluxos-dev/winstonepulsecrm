import { z } from "zod";

const SandboxFile = z.object({
  format: z.literal("winstone-sandbox-v1"),
  synthetic: z.literal(true),
  checkedAt: z.number(),
  callLogAccess: z.string(),
  calls: z.array(z.object({ type: z.number().optional(), durationSeconds: z.number().optional() }).passthrough()),
  recording: z.string(),
  audioDurationMs: z.number().optional(),
  summary: z.string(),
  liveWrites: z.number(),
});

export type CheckResult = "pass" | "fail" | "not_run";
export type SandboxReport = { checkedAt: string; checks: { id: string; label: string; result: CheckResult; detail: string }[]; overall: CheckResult };

export function parseSandboxResults(text: string): SandboxReport {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("This is not a sandbox results file (not valid JSON)."); }
  const p = SandboxFile.safeParse(raw);
  if (!p.success) throw new Error("This is not a winstone-sandbox-v1 results file.");
  const f = p.data;
  const access: CheckResult = f.callLogAccess === "granted" ? "pass" : f.callLogAccess === "unknown" ? "not_run" : "fail";
  const detect: CheckResult = access !== "pass" ? "not_run" : f.calls.length > 0 ? "pass" : "fail";
  const rec: CheckResult = f.recording === "local_file_readable" && (f.audioDurationMs ?? 0) > 0 ? "pass" : f.recording === "not_checked" ? "not_run" : "fail";
  const sum: CheckResult = f.summary === "simulation_saved" ? "pass" : f.summary === "not_run" ? "not_run" : "fail";
  const safe: CheckResult = f.liveWrites === 0 ? "pass" : "fail";
  const checks = [
    { id: "call_log", label: "Call-log access", result: access, detail: f.callLogAccess },
    { id: "detection", label: "Call detection", result: detect, detail: `${f.calls.length} matching calls` },
    { id: "recording", label: "Recording readable", result: rec, detail: `${f.recording} (${f.audioDurationMs ?? 0} ms)` },
    { id: "summary", label: "Summary (simulated)", result: sum, detail: f.summary },
    { id: "isolation", label: "No live CRM writes", result: safe, detail: `${f.liveWrites} live writes` },
  ];
  const overall: CheckResult = checks.some(c => c.result === "fail") ? "fail" : checks.some(c => c.result === "not_run") ? "not_run" : "pass";
  return { checkedAt: new Date(f.checkedAt).toISOString(), checks, overall };
}
