import { describe, expect, it } from "vitest";
import { talkTimeEvidence } from "@/lib/call-reconciliation";

describe("call-history talk-time evidence from the phone", () => {
  it("is stored only when the phone marks it as call-log time", () => {
    expect(talkTimeEvidence({ state: "completed", duration_seconds: 48 })).toEqual({}); // app 2.21: no mark
    expect(talkTimeEvidence({ state: "completed", duration_seconds: 48, talk_time_source: "call_log" }))
      .toEqual({ talk_time_source: "call_log", duration_seconds: 48, call_status: "completed" });
  });
  it("an unanswered call from call history stores 0 s talk time", () => {
    expect(talkTimeEvidence({ state: "no_answer", duration_seconds: 30, talk_time_source: "call_log" }))
      .toEqual({ talk_time_source: "call_log", duration_seconds: 0, call_status: "no_answer" });
  });
  it("completed with no talk time, or a non-final state, is not evidence", () => {
    expect(talkTimeEvidence({ state: "completed", duration_seconds: 0, talk_time_source: "call_log" })).toEqual({});
    expect(talkTimeEvidence({ state: "failed", talk_time_source: "call_log" })).toEqual({});
    expect(talkTimeEvidence({ state: "initiated", duration_seconds: 10, talk_time_source: "call_log" })).toEqual({});
  });
});
