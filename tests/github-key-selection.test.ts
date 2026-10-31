import { afterEach, describe, expect, it, vi } from "vitest";
import { readAndroidSigningReadiness } from "@/lib/github-status.server";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("IT Console GitHub reads pick the linked account that can see the repository", () => {
  it("uses the second linked account when the first cannot see the repo, and lists names only", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "synthetic-project");
    vi.stubEnv("GITHUB_API_KEY", "old-account");
    vi.stubEnv("GITHUB_API_KEY_1", "new-account");
    vi.stubEnv("GITHUB_API_KEY_2", ""); vi.stubEnv("GITHUB_API_KEY_3", "");
    const used: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const key = (init.headers as Record<string, string>)["X-Connection-Api-Key"]!;
      used.push(`${key} ${url.replace(/^.*\/github/, "")}`);
      if (key === "old-account") return new Response("{}", { status: 404 });
      if (url.includes("/actions/secrets")) return Response.json({ secrets: [{ name: "WINSTONE_KEY_ALIAS" }] });
      if (url.includes("/actions/variables")) return Response.json({ variables: [{ name: "WINSTONE_RELEASE_CERT_SHA256", value: "public" }] });
      return Response.json({ full_name: "o/r" });
    }));
    const r = await readAndroidSigningReadiness("o/r");
    expect(r.verdict).toBe("blocked");
    expect(r.missingSecrets).toEqual(["WINSTONE_KEYSTORE_B64", "WINSTONE_KEYSTORE_PASSWORD", "WINSTONE_KEY_PASSWORD"]);
    expect(r.fingerprintRecorded).toBe(true);
    expect(JSON.stringify(r)).not.toContain("public");
    expect(used.filter((u) => u.includes("/actions/")).every((u) => u.startsWith("new-account"))).toBe(true);
  });

  it("reports check_failed (not missing) when no account can list settings", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "synthetic-project");
    vi.stubEnv("GITHUB_API_KEY", "only"); vi.stubEnv("GITHUB_API_KEY_1", ""); vi.stubEnv("GITHUB_API_KEY_2", ""); vi.stubEnv("GITHUB_API_KEY_3", "");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    const r = await readAndroidSigningReadiness("o/r");
    expect(r.verdict).toBe("check_failed");
    expect(r.readStatus).toBe("no_admin_access");
  });
});
