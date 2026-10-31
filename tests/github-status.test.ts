import { afterEach, describe, expect, it, vi } from "vitest";
const scope = vi.hoisted(() => vi.fn());
const storage = vi.hoisted(() => ({ insert: vi.fn(async (_row: unknown) => ({ error: null as null | { message: string } })) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ insert: storage.insert }) } }));
vi.mock("@/lib/admin-gate.server", () => ({ adminTokenScope: scope }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({
  inputValidator: (validate: (input: unknown) => unknown) => ({
    handler: (handler: (input: { data: unknown }) => unknown) => (data: unknown) => handler({ data: validate(data) }),
  }),
}) }));
import { getGithubRepositoryStatus } from "@/lib/github-status.functions";
import { readGithubStatus } from "@/lib/github-status.server";
const invoke = getGithubRepositoryStatus as unknown as (input: unknown) => ReturnType<typeof readGithubStatus>;
const input = { adminToken: null, repository: "example/private-crm" };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function prepare() {
  scope.mockReturnValue("full");
  vi.stubEnv("GITHUB_API_KEY", "synthetic-connection");
  vi.stubEnv("LOVABLE_API_KEY", "synthetic-project");
  const transport = vi.fn(async (url: string) => {
    if (url.endsWith("/repos/example/private-crm")) return Response.json({ full_name: "example/private-crm", private: true, default_branch: "main", permissions: { pull: true, push: false } });
    if (url.includes("/branches/")) return Response.json({ name: "main", commit: { sha: "abcdef123456" }, protected: true });
    return Response.json({ workflow_runs: [{ id: 12, name: "CI", status: "completed", conclusion: "failure", updated_at: "2026-10-29T02:00:00Z" }] });
  });
  vi.stubGlobal("fetch", transport);
  return transport;
}
describe("GitHub repository status authorization and evidence", () => {
  it.each([null, "hq", "leadhub"])("rejects %s before provider reads", async value => {
    const transport = prepare(); scope.mockReturnValue(value);
    await expect(invoke(input)).rejects.toThrow("Full IT PIN required");
    expect(transport).not.toHaveBeenCalled();
  });
  it("validates repository paths before authorization", () => {
    expect(() => invoke({ ...input, repository: "../repos/private?secret=x" })).toThrow();
    expect(scope).not.toHaveBeenCalled();
  });
  it("preserves GitHub facts and never infers sync status or write permission", async () => {
    const transport = prepare();
    const result = await invoke(input);
    expect(result).toMatchObject({ repository: "example/private-crm", private: true, branch: "main", protected: true, canRead: true, canWrite: false, connectedRepository: null, syncedBranch: null, pendingChanges: null, syncErrors: null });
    expect(result.runs[0]?.conclusion).toBe("failure");
    expect(storage.insert).toHaveBeenCalledWith(expect.objectContaining({ action: "github_repository_status_checked", metadata: expect.objectContaining({ outcome: "success", repository: "example/private-crm", canWrite: false }) }));
    expect(JSON.stringify(result)).not.toContain("synthetic-connection");
    expect(transport).toHaveBeenCalledTimes(3);
    for (const [url, options] of transport.mock.calls as unknown as [string, RequestInit][]) {
      expect(url.startsWith("https://connector-gateway.lovable.dev/github/repos/example/private-crm")).toBe(true);
      expect(options.method ?? "GET").toBe("GET");
      expect(options.signal).toBeDefined();
    }
  });
  it("encodes custom branch names and bounds workflow history", async () => {
    const transport = prepare(); await invoke({ ...input, branch: "release/next" });
    expect(transport.mock.calls.map(call => call[0])).toContain("https://connector-gateway.lovable.dev/github/repos/example/private-crm/branches/release%2Fnext");
    expect(transport.mock.calls.map(call => call[0])).toContain("https://connector-gateway.lovable.dev/github/repos/example/private-crm/actions/runs?branch=release%2Fnext&per_page=5");
  });
  it("missing connection fails without network traffic", async () => {
    const transport = prepare(); vi.stubEnv("GITHUB_API_KEY", "");
    await expect(invoke(input)).rejects.toThrow("CONNECTION_NOT_CONFIGURED"); expect(transport).not.toHaveBeenCalled();
  });
  it("provider failures are unavailable, not an empty healthy history", async () => {
    prepare(); const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("sensitive upstream detail", { status: 403 })));
    await expect(invoke(input)).rejects.toThrow("HTTP_403");
    expect(storage.insert).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ outcome: "failed", errorCode: "HTTP_403" }) }));
    expect(JSON.stringify(storage.insert.mock.calls)).not.toContain("sensitive upstream detail");
    expect(log).toHaveBeenCalledWith("GitHub status read failed [403]"); log.mockRestore();
  });
  it("reports a failed history write without hiding a successful check", async () => {
    prepare(); storage.insert.mockResolvedValueOnce({ error: { message: "unavailable" } });
    expect(await invoke(input)).toMatchObject({ historyRecorded: false, canWrite: false });
  });
});