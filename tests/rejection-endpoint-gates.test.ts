import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ kind: "device", blocked: false, submit: vi.fn(), ledger: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (v: unknown) => v }));
vi.mock("@/lib/device-auth.server", () => ({ resolveApiCaller: async () => ({ kind: state.kind, profile: { id: "verified-agent" }, device: { id: "device-a" } }) }));
vi.mock("@/lib/agent-briefing.server", () => ({ requireAgentBriefing: async () => state.blocked ? { reason: "Briefing acknowledgement required", briefing: {} } : null }));
vi.mock("@/lib/call-reports.server", () => ({ submitCallReport: (input: unknown) => state.submit(input) }));
vi.mock("@/lib/version-ledger.server", () => ({ recordVersionData: (input: unknown) => state.ledger(input) }));
import { Route } from "@/routes/api/public/agent/report";
const route = Route as unknown as { server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } } };
function post(category: string) {
  return route.server.handlers.POST({ request: new Request("http://localhost/api/public/agent/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "submit", report_id: "00000000-0000-4000-8000-000000000001", category, direction: "outgoing", call_status: "connected", duration_seconds: 3, agent_id: "forged-agent", scope: "authority", briefing_acknowledged: true }) }) });
}
beforeEach(() => { state.kind = "device"; state.blocked = false; state.submit.mockReset().mockResolvedValue({ ok: true }); state.ledger.mockReset(); });
describe("Android rejection endpoint keeps verified identity and briefing gates", () => {
  for (const category of ["not_interested", "wrong_number", "fake"]) {
    it(`${category} refuses anonymous callers before report writes`, async () => {
      state.kind = "none"; expect((await post(category)).status).toBe(401); expect(state.submit).not.toHaveBeenCalled(); expect(state.ledger).not.toHaveBeenCalled();
    });
    it(`${category} cannot spoof briefing acknowledgement`, async () => {
      state.blocked = true; expect((await post(category)).status).toBe(403); expect(state.submit).not.toHaveBeenCalled(); expect(state.ledger).not.toHaveBeenCalled();
    });
    it(`${category} forwards only the verified device agent, ignoring forged authority/identity`, async () => {
      expect((await post(category)).status).toBe(200); expect(state.submit).toHaveBeenCalledWith(expect.objectContaining({ agentId: "verified-agent", category, durationSeconds: 3 }));
    });
  }
});