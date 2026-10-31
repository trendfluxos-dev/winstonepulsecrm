import { describe, expect, it } from "vitest";
import { attemptCount, compareQueue, lastWasNotReceived, summarizeReports, type QueueLead } from "@/lib/desk-queue";

const now = Date.parse("2026-10-31T08:00:00Z");
const lead = (id: string, extra: Partial<QueueLead> = {}): QueueLead => ({ id, status: "pending", call_attempts: 0, ...extra });

describe("desk queue: did-not-receive leads go to the back", () => {
  it("puts a no-answer lead behind fresh leads even when its retry time has passed", () => {
    const missed = lead("missed", { outcome_category: "no_answer", last_call_at: "2026-10-30T05:00:00Z", retry_after: "2026-10-31T01:00:00Z", work_state: "snoozed" });
    const fresh = lead("fresh", { serial_no: "10" });
    const order = [missed, fresh].sort((a, b) => compareQueue(a, b, new Map(), now)).map((l) => l.id);
    expect(order).toEqual(["fresh", "missed"]);
  });

  it("rotates retries: the longest-waiting attempt comes first among them", () => {
    const older = lead("older", { outcome_category: "no_answer", last_call_at: "2026-10-29T05:00:00Z" });
    const newer = lead("newer", { outcome_category: "busy", last_call_at: "2026-10-31T05:00:00Z" });
    const order = [newer, older].sort((a, b) => compareQueue(a, b, new Map(), now)).map((l) => l.id);
    expect(order).toEqual(["older", "newer"]);
  });

  it("a lead with a saved report but no call_attempts still counts as a retry", () => {
    const reported = lead("reported");
    const fresh = lead("fresh");
    const s = summarizeReports([{ lead_id: "reported", submitted_at: "2026-10-30T05:00:00Z", category: "no_answer" }]);
    const order = [reported, fresh].sort((a, b) => compareQueue(a, b, s, now)).map((l) => l.id);
    expect(order).toEqual(["fresh", "reported"]);
    expect(lastWasNotReceived(reported, s.get("reported"))).toBe(true);
  });

  it("an overdue customer follow-up still comes before fresh leads", () => {
    const due = lead("due", { status: "follow_up", outcome_category: "callback", retry_after: "2026-10-31T07:00:00Z", call_attempts: 1, last_call_at: "2026-10-30T05:00:00Z" });
    const fresh = lead("fresh");
    expect([fresh, due].sort((a, b) => compareQueue(a, b, new Map(), now)).map((l) => l.id)).toEqual(["due", "fresh"]);
  });
});

describe("attempt numbering", () => {
  it("counts 1 after one saved report and 2 after two, even when call_attempts stayed 0", () => {
    const one = summarizeReports([{ lead_id: "a", submitted_at: "2026-10-30T05:00:00Z" }]);
    expect(attemptCount({ call_attempts: 0 }, one.get("a"))).toBe(1);
    const two = summarizeReports([
      { lead_id: "a", submitted_at: "2026-10-30T05:00:00Z", category: "no_answer" },
      { lead_id: "a", submitted_at: "2026-10-31T05:00:00Z", category: "busy" },
    ]);
    expect(attemptCount({ call_attempts: 0 }, two.get("a"))).toBe(2);
    expect(two.get("a")?.lastCategory).toBe("busy");
  });

  it("never shows fewer attempts than the stored call counter", () => {
    expect(attemptCount({ call_attempts: 3 }, null)).toBe(3);
    expect(attemptCount({ call_attempts: 0 }, null)).toBe(0);
  });

  it("ignores unsubmitted drafts", () => {
    const s = summarizeReports([{ lead_id: "a", submitted_at: null }]);
    expect(s.size).toBe(0);
  });
});

import { leadAttemptInfo } from "@/lib/desk-queue";

describe("lead details panel attempts", () => {
  it("shows 2 attempts and the latest call time from two saved reports when the counter is 0", () => {
    const info = leadAttemptInfo({ call_attempts: 0, last_call_at: null }, [
      { submitted_at: "2026-10-31T05:01:00Z", call_ended_at: "2026-10-31T05:00:00Z", category: "no_answer" },
      { submitted_at: "2026-10-30T05:01:00Z", call_ended_at: "2026-10-30T05:00:00Z", category: "busy" },
      { submitted_at: null, call_ended_at: "2026-10-31T07:00:00Z", category: null },
    ]);
    expect(info).toEqual({ attempts: 2, lastAttemptAt: "2026-10-31T05:00:00Z", lastCategory: "no_answer" });
  });

  it("keeps a newer stored last call and a higher stored counter", () => {
    const info = leadAttemptInfo({ call_attempts: 4, last_call_at: "2026-10-31T09:00:00Z" }, [
      { submitted_at: "2026-10-31T05:01:00Z", call_ended_at: "2026-10-31T05:00:00Z" },
    ]);
    expect(info.attempts).toBe(4);
    expect(info.lastAttemptAt).toBe("2026-10-31T09:00:00Z");
  });

  it("no calls and no reports shows zero and no time", () => {
    expect(leadAttemptInfo({ call_attempts: 0, last_call_at: null }, [])).toEqual({ attempts: 0, lastAttemptAt: null, lastCategory: null });
  });
});
