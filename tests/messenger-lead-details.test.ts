import { describe, expect, it, vi } from "vitest";
import { messengerLeadLookupAllowed } from "@/lib/messenger-lead-details";
import { readMessengerLinkedLead } from "@/lib/messenger-lead-details.server";

const id = "00000000-0000-4000-8000-000000000001";
const lead = { name: "Synthetic", phone_number: "synthetic", address: null, source: "messenger", status: "new", temperature: null, grade: null, assigned_to: "agent-1", assigned_agent_id: null };
const message = { lead_id: "lead-1", created_at: "2026-10-25T03:35:00Z", messenger_threads: { assigned_agent_id: "agent-1" } };
const store = () => ({ message: vi.fn().mockResolvedValue(message), lead: vi.fn().mockResolvedValue(lead) });
describe("Messenger linked lead details", () => {
  it("demo IDs and disconnected threads never enable customer lookups", () => {
    expect(messengerLeadLookupAllowed(true, { id: "demo-1", storedMessageId: id })).toBe(false);
    expect(messengerLeadLookupAllowed(false, { id, storedMessageId: id })).toBe(false);
    expect(messengerLeadLookupAllowed(true, { id })).toBe(false);
    expect(messengerLeadLookupAllowed(true, { id, storedMessageId: id })).toBe(true);
  });
  it("disconnected reads do not touch saved messages or leads", async () => {
    const db = store(); expect(await readMessengerLinkedLead({ scope: "authority" }, false, id, db)).toEqual({ ok: false, code: "DISCONNECTED" });
    expect(db.message).not.toHaveBeenCalled(); expect(db.lead).not.toHaveBeenCalled();
  });
  it("signed-out reads do not touch records", async () => {
    const db = store(); await readMessengerLinkedLead({ scope: "none" }, true, id, db); expect(db.message).not.toHaveBeenCalled();
  });
  it("other agent threads never read a lead", async () => {
    const db = store(); expect(await readMessengerLinkedLead({ scope: "agent", profile: { id: "agent-2" } }, true, id, db)).toEqual({ ok: false, code: "UNAVAILABLE" });
    expect(db.lead).not.toHaveBeenCalled();
  });
  it("current lead ownership is checked independently of thread ownership", async () => {
    const db = store(); db.lead.mockResolvedValue({ ...lead, assigned_to: "agent-2" });
    expect(await readMessengerLinkedLead({ scope: "agent", profile: { id: "agent-1" } }, true, id, db)).toEqual({ ok: false, code: "UNAVAILABLE" });
  });
  it("secondary assignment column supports a genuinely owned lead", async () => {
    const db = store(); db.lead.mockResolvedValue({ ...lead, assigned_to: null, assigned_agent_id: "agent-1" });
    const result = await readMessengerLinkedLead({ scope: "agent", profile: { id: "agent-1" } }, true, id, db);
    expect(result.ok).toBe(true); if (result.ok) expect(result.lead.arrivedAt).toBe(message.created_at);
  });
  it("unlinked messages never guess a lead from names or phone", async () => {
    const db = store(); db.message.mockResolvedValue({ ...message, lead_id: null });
    expect(await readMessengerLinkedLead({ scope: "authority" }, true, id, db)).toEqual({ ok: false, code: "UNLINKED" }); expect(db.lead).not.toHaveBeenCalled();
  });
  it("authority receives only projected read-only details", async () => {
    const result = await readMessengerLinkedLead({ scope: "authority" }, true, id, store());
    expect(result).toEqual({ ok: true, lead: { name: "Synthetic", phone: "synthetic", address: null, source: "messenger", status: "new", temperature: null, grade: null, arrivedAt: message.created_at } });
  });
});