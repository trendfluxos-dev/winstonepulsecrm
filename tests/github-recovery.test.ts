import { expect, it } from "vitest";
import { githubRecovery } from "../src/lib/github-recovery";
it("never retries missing IT authority", () => expect(githubRecovery("Full IT PIN required")).toEqual({ retry: false, kind: "access" }));
it.each(["HTTP_401", "HTTP_403", "CONNECTION_NOT_CONFIGURED"])("requires connection recovery for %s", code => expect(githubRecovery(code)).toEqual({ retry: false, kind: "connection" }));
it("requires repository correction on not found", () => expect(githubRecovery("HTTP_404")).toEqual({ retry: false, kind: "repository" }));
it.each(["HTTP_502", "HTTP_429", "READ_FAILED"])("allows a user initiated retry for %s", code => expect(githubRecovery(code).retry).toBe(true));