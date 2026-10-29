import { z } from "zod";

export const sandboxResultSchema = z.object({
  format: z.literal("winstone-sandbox-v1"), synthetic: z.literal(true),
  checkedAt: z.number().int().nonnegative(), liveWrites: z.literal(0),
  callLogAccess: z.enum(["unknown", "granted", "denied", "read_failed"]),
  calls: z.array(z.object({ leadId: z.literal("synthetic-001"), at: z.number().nonnegative(), type: z.number().int().min(1).max(7), durationSeconds: z.number().nonnegative() })).max(20),
  recording: z.enum(["not_checked", "unreadable", "local_file_readable"]),
  audioDurationMs: z.number().nonnegative(),
  summary: z.enum(["not_run", "simulation_failed", "simulation_saved"]),
  summaryText: z.string().max(240),
}).strict();
export type SandboxResult = z.infer<typeof sandboxResultSchema>;
export function simulateSandbox(text: string, now: number): SandboxResult {
  return { format: "winstone-sandbox-v1", synthetic: true, checkedAt: now, liveWrites: 0,
    callLogAccess: "unknown", calls: [], recording: "not_checked", audioDurationMs: 0,
    summary: text.trim() ? "simulation_saved" : "simulation_failed", summaryText: text.trim().slice(0, 240) };
}