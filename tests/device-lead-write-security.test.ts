import { beforeEach, describe, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ owner: "agent-a" as string | null, legacy: "agent-a" as string | null, error: false, writes: [] as string[], intakeOwner: "unset" as string | null, events: 0 }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (v: unknown) => v }));
vi.mock("@/lib/device-auth.server", () => ({ resolveApiCaller: async () => ({ kind: "device", profile: { id: "agent-a" } }) }));
vi.mock("@/lib/lead-intake.server", () => ({ intakeLead: async (v: { ownerId: string | null }) => { s.intakeOwner = v.ownerId; return { leadId: "11111111-1111-4111-8111-111111111111", duplicate: true }; }, InvalidLeadPhoneError: class extends Error {} }));
vi.mock("@/lib/lead-events.server", () => ({ logLeadEvent: async () => { s.events++; } }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  const chain = { select: () => chain, eq: () => chain, insert: () => { s.writes.push(table); return chain; }, update: () => { s.writes.push(table); return chain; },
    maybeSingle: async () => ({ data: s.error ? null : table === "profiles" ? { id: "agent-a", name: "Agent A" } : { assigned_to: s.owner, assigned_agent_id: s.legacy }, error: s.error ? { message: "failed" } : null }),
    then: (fn: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(fn),
  }; return chain;
} } }));
import { Route as Message } from "@/routes/api/public/ingest/message";
import { Route as Presence } from "@/routes/api/public/agent/presence";
type Handler = { server: { handlers: { POST: (v: { request: Request }) => Promise<Response> } } };
const ID = "11111111-1111-4111-8111-111111111111";
const invoke = (route: unknown, data: unknown) => (route as Handler).server.handlers.POST({ request: new Request("https://example.test/api/public/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }) });
beforeEach(() => { s.owner = "agent-a"; s.legacy = "agent-a"; s.error = false; s.writes = []; s.events = 0; s.intakeOwner = "unset"; });
describe("device messages and presence require canonical ownership", () => {
 for (const [label, route, body] of [
  ["message ID", Message, { lead_id: ID, sender_type: "agent", message_content: "synthetic" }],
  ["message phone duplicate", Message, { phone_number: "01700000000", sender_type: "customer", message_content: "synthetic" }],
  ["presence", Presence, { lead_id: ID, presence: "on_call", agent_id: "22222222-2222-4222-8222-222222222222" }],
 ] as const) {
  for (const [caseName, owner, legacy] of [["foreign", "agent-b", "agent-b"], ["legacy foreign", null, "agent-b"], ["unassigned", null, null], ["conflicting", "agent-a", "agent-b"]] as const) it(`${label} rejects ${caseName} without writes`, async () => {
   s.owner = owner; s.legacy = legacy;
   expect((await invoke(route, body)).status).toBe(403); expect(s.writes).toEqual([]); expect(s.events).toBe(0);
  });
  it(`${label} preserves own writes`, async () => {
   s.owner = null;
   expect((await invoke(route, body)).status).toBe(label === "presence" ? 200 : 201); expect(s.events).toBe(1);
   expect(s.writes).toEqual([label === "presence" ? "profiles" : "whatsapp_interactions"]);
  });
 }
 it("phone intake never assigns a lead", async () => {
  await invoke(Message, { phone_number: "01700000000", sender_type: "agent", message_content: "synthetic" }); expect(s.intakeOwner).toBeNull();
 });
 it("ownership read errors fail closed", async () => {
  s.error = true;
  expect((await invoke(Message, { lead_id: ID, sender_type: "agent", message_content: "synthetic" })).status).toBe(403); expect(s.writes).toEqual([]);
 });
 it("presence without a lead keeps the normal device beacon", async () => {
  expect((await invoke(Presence, { presence: "idle" })).status).toBe(200); expect(s.events).toBe(0);
 });
});