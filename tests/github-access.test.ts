import { describe, expect, it } from "vitest";
import { classifyAccess } from "@/lib/github-access";

describe("classifyAccess", () => {
  it("visible repo is ready", () => expect(classifyAccess("visible", false)).toBe("ready"));
  it("not found with pending invite asks to accept", () => expect(classifyAccess("not_found", true)).toBe("invite_pending"));
  it("not found without invite is no access", () => expect(classifyAccess("not_found", false)).toBe("no_access"));
  it("errors are never shown as no access", () => expect(classifyAccess("error", true)).toBe("check_failed"));
});
