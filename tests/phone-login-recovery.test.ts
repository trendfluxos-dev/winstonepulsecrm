import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ active: true, approval: "approved", sim: "bound", tokens: 0 }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { signInWithPassword: async () => ({ data: { user: { id: "u", app_metadata: {} } }, error: null }) } }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  const b = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: { id: "a", user_id: "u", role: "agent", employee_id: "WIN1", is_active: m.active, approval_status: m.approval, phone: "01805049666", sim_number: "01805049666" }, error: null }) };
  return b;
} } }));
vi.mock("@/lib/agent-sim.server", () => ({ bindAgentSim: async () => m.sim === "conflict" ? { status: "conflict", ownerName: "Other" } : m.sim === "invalid" ? { status: "invalid", sim: null } : { status: "bound", sim: "01805049666" } }));
vi.mock("@/lib/device-auth.server", () => ({ issueDeviceToken: async () => { m.tokens++; return { token: "test-only-device-token", deviceId: "d" }; } }));
import { Route } from "@/routes/api/public/agent/login";
beforeEach(() => { m.active = true; m.approval = "approved"; m.sim = "bound"; m.tokens = 0; vi.stubEnv("SUPABASE_URL", "https://example.invalid"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_only"); });
const run = () => (Route as unknown as { server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } } }).server.handlers.POST({ request: new Request("https://example.invalid/api/public/agent/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "unit@example.invalid", password: "test-only-password", sim_number: "01805049666" }) }) });
describe("phone login recovery never bypasses access", () => {
  it("inactive approved account is not mislabeled pending and receives no token", async () => {
    m.active = false; const response = await run();
    expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ code: "inactive" }); expect(m.tokens).toBe(0);
  });
  it("pending approval remains blocked", async () => {
    m.approval = "pending"; const response = await run();
    expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ code: "pending_approval" }); expect(m.tokens).toBe(0);
  });
  it("SIM conflict has recovery but issues no token", async () => {
    m.sim = "conflict"; const response = await run();
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: "sim_conflict" }); expect(m.tokens).toBe(0);
  });
  it("invalid SIM never claims verified login", async () => {
    m.sim = "invalid"; const response = await run();
    expect(response.status).toBe(422); expect(await response.json()).toMatchObject({ code: "sim_invalid" }); expect(m.tokens).toBe(0);
  });
});