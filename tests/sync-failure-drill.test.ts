import { describe, expect, it } from "vitest";
import { checkSyncDrill, sandboxResultSchema, type SyncDrill } from "@/lib/call-sandbox";

const base = { format: "winstone-sandbox-v1", synthetic: true, checkedAt: 1, liveWrites: 0, callLogAccess: "unknown", calls: [],
  recording: "not_checked", audioDurationMs: 0, summary: "not_run", summaryText: "" } as const;
const msg = "CRM busy / retrying";
const retried: SyncDrill = { scenario: "server_error_then_ok", expectRetryable: true, final: "sent", historyEntries: 1, failureLogEntries: 1, attempts: [
  { attempt: 1, reply: "http", http: 500, kind: "server_error", retryable: true, decision: "retry", agentMessage: msg },
  { attempt: 2, reply: "ok", http: 200, kind: null, retryable: null, decision: "sent", agentMessage: null },
] };
const permanent: SyncDrill = { scenario: "lead_not_assigned", expectRetryable: false, final: "failed_permanent", historyEntries: 0, failureLogEntries: 1, attempts: [
  { attempt: 1, reply: "http", http: 403, kind: "access_denied", retryable: false, decision: "stop", agentMessage: "Not assigned / contact LeadHub" },
] };

describe("sync failure drill import", () => {
  it("accepts older sandbox files without a drill and files with one", () => {
    expect(sandboxResultSchema.safeParse(base).success).toBe(true);
    expect(sandboxResultSchema.safeParse({ ...base, syncDrills: [retried, permanent] }).success).toBe(true);
  });
  it("refuses anything that claims live writes or an unknown scenario", () => {
    expect(sandboxResultSchema.safeParse({ ...base, liveWrites: 1, syncDrills: [retried] }).success).toBe(false);
    expect(sandboxResultSchema.safeParse({ ...base, syncDrills: [{ ...retried, scenario: "drop_database" }] }).success).toBe(false);
  });
});

describe("drill checks", () => {
  it("passes a retried failure that reached the CRM once", () => {
    expect(checkSyncDrill(retried).passed).toBe(true);
  });
  it("fails when retries duplicated call history", () => {
    expect(checkSyncDrill({ ...retried, historyEntries: 2 })).toMatchObject({ passed: false, reason: "Retries duplicated call history" });
  });
  it("fails when a temporary failure stopped instead of retrying", () => {
    expect(checkSyncDrill({ ...retried, final: "failed_permanent" }).passed).toBe(false);
  });
  it("passes a permanent failure that stopped after one attempt with an agent message", () => {
    expect(checkSyncDrill(permanent).passed).toBe(true);
  });
  it("fails a permanent failure that was retried, wrote history or gave no message", () => {
    expect(checkSyncDrill({ ...permanent, attempts: [permanent.attempts[0]!, { ...permanent.attempts[0]!, attempt: 2 }] }).reason).toBe("Permanent failure was retried");
    expect(checkSyncDrill({ ...permanent, historyEntries: 1 }).reason).toBe("Permanent failure wrote call history");
    expect(checkSyncDrill({ ...permanent, attempts: [{ ...permanent.attempts[0]!, agentMessage: null }] }).reason).toBe("Agent was not told what to do");
  });
  it("fails when the phone labels a permanent scenario as retryable", () => {
    expect(checkSyncDrill({ ...permanent, expectRetryable: true }).passed).toBe(false);
  });
});
