import { describe, expect, it } from "vitest";

import { qualifyCallReport } from "@/lib/call-qualification";
import { FAKE_NEEDS_ANSWERED_CALL, fakeNeedsAnsweredCall } from "@/lib/fast-disqualification";

describe("FAKE LEAD requires an answered call", () => {
  it("refuses FAKE LEAD on an unanswered call with the Bengali message", () => {
    expect(() => qualifyCallReport({ category: "fake", connected: false, followUpPending: false })).toThrow(
      FAKE_NEEDS_ANSWERED_CALL.bn,
    );
  });

  it("accepts FAKE LEAD on an answered call as a fast rejection", () => {
    const result = qualifyCallReport({ category: "fake", connected: true, followUpPending: false });
    expect(result.rejection).not.toBeNull();
    expect(result.grade).toBeNull();
  });

  it("keeps NOT INTERESTED, WRONG NUMBER and NO ANSWER allowed on unanswered calls", () => {
    for (const category of ["not_interested", "wrong_number", "no_answer"]) {
      expect(() => qualifyCallReport({ category, connected: false, followUpPending: false })).not.toThrow();
      expect(fakeNeedsAnsweredCall(category, false)).toBe(false);
    }
  });
});
