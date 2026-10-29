import { expect, it } from "vitest";
import { githubCheckErrorCode, githubHistoryEntry } from "../src/lib/github-status-shared";
it("does not store arbitrary provider error text or credentials", () => {
  expect(githubCheckErrorCode(new Error("secret upstream payload"))).toBe("READ_FAILED");
  expect(githubCheckErrorCode(new Error("GitHub read failed (HTTP 404)"))).toBe("HTTP_404");
});
it("history projection strips unrecognized properties", () => {
  const row = githubHistoryEntry.parse({ repository: "org/repo", requestedBranch: null, branch: "main", checkedAt: "2026-10-29T03:00:00Z", outcome: "success", private: true, sha: "abc", canRead: true, canWrite: false, protected: true, errorCode: null, runs: [], token: "must-not-return" });
  expect(row).not.toHaveProperty("token");
});