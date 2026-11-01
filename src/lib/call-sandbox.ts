import { z } from "zod";

export const SYNC_DRILL_SCENARIOS = [
  "server_error_then_ok", "offline_then_ok", "rate_limited_then_ok", "lost_ack_then_retry", "sign_in_expired_then_ok",
  "lead_not_assigned", "data_rejected", "call_conflict", "app_update_required",
] as const;
/** Scenarios the CRM must eventually accept; the rest must stop without retrying. */
export const RETRYABLE_DRILLS: ReadonlySet<string> = new Set(SYNC_DRILL_SCENARIOS.slice(0, 5));

const drillAttemptSchema = z.object({
  attempt: z.number().int().min(1).max(20),
  reply: z.enum(["http", "offline", "ok", "ack_lost"]),
  http: z.number().int().min(0).max(599).nullable(),
  kind: z.string().regex(/^[a-z_]{1,32}$/).nullable(),
  retryable: z.boolean().nullable(),
  decision: z.enum(["retry", "stop", "sent"]),
  agentMessage: z.string().max(300).nullable(),
}).strict();
export const syncDrillSchema = z.object({
  scenario: z.enum(SYNC_DRILL_SCENARIOS),
  expectRetryable: z.boolean(),
  final: z.enum(["sent", "failed_permanent", "gave_up"]),
  attempts: z.array(drillAttemptSchema).min(1).max(20),
  historyEntries: z.number().int().min(0).max(20),
  failureLogEntries: z.number().int().min(0).max(50),
}).strict();
export type SyncDrill = z.infer<typeof syncDrillSchema>;

export type DrillCheck = { scenario: string; passed: boolean; reason: string };
/**
 * Independent check of an imported drill: retryable failures must end sent with
 * exactly one history entry (retries never duplicate it); permanent failures
 * must stop after one attempt, write no history and show the agent a reason.
 */
export function checkSyncDrill(d: SyncDrill): DrillCheck {
  const fail = (reason: string) => ({ scenario: d.scenario, passed: false, reason });
  const retryable = RETRYABLE_DRILLS.has(d.scenario);
  if (d.expectRetryable !== retryable) return fail("Scenario type does not match the CRM's expectation");
  if (retryable) {
    if (d.final !== "sent") return fail("Retryable failure never reached the CRM");
    if (d.historyEntries !== 1) return fail(d.historyEntries > 1 ? "Retries duplicated call history" : "No call history was recorded");
    if (d.attempts.slice(0, -1).some((a) => a.decision !== "retry" || a.retryable !== true)) return fail("A temporary failure was not retried");
    return { scenario: d.scenario, passed: true, reason: `Sent after ${d.attempts.length} attempt(s), one history entry` };
  }
  if (d.final !== "failed_permanent") return fail("Permanent failure was not stopped");
  if (d.attempts.length !== 1) return fail("Permanent failure was retried");
  if (d.historyEntries !== 0) return fail("Permanent failure wrote call history");
  if (!d.attempts[0]!.agentMessage) return fail("Agent was not told what to do");
  return { scenario: d.scenario, passed: true, reason: "Stopped after one attempt with an agent message" };
}

export const sandboxResultSchema = z.object({
  format: z.literal("winstone-sandbox-v1"), synthetic: z.literal(true),
  checkedAt: z.number().int().nonnegative(), liveWrites: z.literal(0),
  callLogAccess: z.enum(["unknown", "granted", "denied", "read_failed"]),
  calls: z.array(z.object({ leadId: z.literal("synthetic-001"), at: z.number().nonnegative(), type: z.number().int().min(1).max(7), durationSeconds: z.number().nonnegative() }).strict()).max(20),
  recording: z.enum(["not_checked", "unreadable", "local_file_readable"]),
  audioDurationMs: z.number().nonnegative(),
  summary: z.enum(["not_run", "simulation_failed", "simulation_saved"]),
  summaryText: z.string().max(240),
  syncDrills: z.array(syncDrillSchema).max(SYNC_DRILL_SCENARIOS.length).optional(),
}).strict();
export type SandboxResult = z.infer<typeof sandboxResultSchema>;
export function simulateSandbox(text: string, now: number): SandboxResult {
  return { format: "winstone-sandbox-v1", synthetic: true, checkedAt: now, liveWrites: 0,
    callLogAccess: "unknown", calls: [], recording: "not_checked", audioDurationMs: 0,
    summary: text.trim() ? "simulation_saved" : "simulation_failed", summaryText: text.trim().slice(0, 240) };
}