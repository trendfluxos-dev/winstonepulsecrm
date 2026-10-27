import { describe, expect, it, vi } from "vitest";

import { authorizeReplyTarget, type ReplyActor, type ReplyTargetRow } from "@/lib/messenger-reply-auth.server";
import { guardedSendReply, type ReplyStore } from "@/lib/messenger-reply.server";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const THREAD = "33333333-3333-4333-8333-333333333333";
const OTHER_THREAD = "44444444-4444-4444-8444-444444444444";
const LEAD = "55555555-5555-4555-8555-555555555555";
const OTHER_LEAD = "66666666-6666-4666-8666-666666666666";

const agent: ReplyActor = { scope: "agent", readOnly: false, userId: "u1", profileId: ME };
const ownRow: ReplyTargetRow = { id: THREAD, psid: "PSID_SYNTH", leadId: LEAD, assignedAgentId: ME, lead: { assigned_to: ME, assigned_agent_id: ME } };
const allClear = { appSecretConfigured: true, pageTokenConfigured: true, pageIdConfigured: true, allTracksVerified: true, syncEnabled: true };

function store(rows: Record<string, ReplyTargetRow>) {
  const calls = { inserted: [] as { threadId: string }[], lookups: 0 };
  const s: ReplyStore = {
    async getReplyTarget(id) { calls.lookups += 1; return rows[id] ?? null; },
    async insertOutbox(row) { calls.inserted.push(row); return "ob-1"; },
    async markSent() {},
    async markFailed() {},
  };
  return { s, calls };
}

const okFetch = () => vi.fn(async () => new Response(JSON.stringify({ message_id: "m.synthetic" }), { status: 200 }));

async function send(actor: ReplyActor, threadId: string, leadId: string | null, rows: Record<string, ReplyTargetRow>) {
  const { s, calls } = store(rows);
  const sendFetch = okFetch();
  const result = await guardedSendReply(
    { threadId, leadId, text: "synthetic", requestId: crypto.randomUUID(), staffConfirmed: true, actor },
    { env: { META_PAGE_ID: "p", META_PAGE_ACCESS_TOKEN: "synthetic" }, store: s, gate: allClear, sendFetch: sendFetch as never },
  );
  return { result, calls, sendFetch };
}

describe("Messenger reply authorization (server-side)", () => {
  it("allows the assigned agent on their own lead's thread and sends to the stored recipient", async () => {
    const { result, calls, sendFetch } = await send(agent, THREAD, LEAD, { [THREAD]: ownRow });
    expect(result).toEqual({ ok: true, sentMid: "m.synthetic" });
    expect(calls.inserted[0]?.threadId).toBe(THREAD);
    expect(JSON.parse((sendFetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).recipient.id).toBe("PSID_SYNTH");
  });

  it("refuses unauthenticated callers before any lookup", async () => {
    const { result, calls, sendFetch } = await send({ scope: "none", readOnly: true, userId: null, profileId: null }, THREAD, LEAD, { [THREAD]: ownRow });
    expect(result).toEqual({ ok: false, code: "UNAUTHENTICATED" });
    expect(calls.lookups).toBe(0);
    expect(sendFetch).not.toHaveBeenCalled();
  });

  it("refuses HQ/authority and read-only roles", async () => {
    for (const a of [{ ...agent, scope: "authority" as const }, { ...agent, readOnly: true }]) {
      const { result, calls, sendFetch } = await send(a, THREAD, LEAD, { [THREAD]: ownRow });
      expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
      expect(calls.lookups).toBe(0);
      expect(sendFetch).not.toHaveBeenCalled();
    }
  });

  it("refuses another agent's thread and another agent's lead", async () => {
    const foreignThread = { ...ownRow, assignedAgentId: OTHER, lead: { assigned_to: OTHER, assigned_agent_id: OTHER } };
    const leadElsewhere = { ...ownRow, lead: { assigned_to: OTHER, assigned_agent_id: OTHER } };
    const conflicted = { ...ownRow, lead: { assigned_to: ME, assigned_agent_id: OTHER } };
    for (const row of [foreignThread, leadElsewhere, conflicted]) {
      const { result, calls, sendFetch } = await send(agent, THREAD, LEAD, { [THREAD]: row });
      expect(result).toEqual({ ok: false, code: "THREAD_NOT_FOUND" });
      expect(calls.inserted).toHaveLength(0);
      expect(sendFetch).not.toHaveBeenCalled();
    }
  });

  it("refuses mismatched conversation/lead IDs", async () => {
    const { result, sendFetch } = await send(agent, THREAD, OTHER_LEAD, { [THREAD]: ownRow });
    expect(result).toEqual({ ok: false, code: "THREAD_NOT_FOUND" });
    expect(sendFetch).not.toHaveBeenCalled();
  });

  it("refuses missing, unlinked or invalid conversations", async () => {
    const unlinked = { ...ownRow, leadId: null, lead: null };
    const noPsid = { ...ownRow, psid: null };
    for (const rows of [{}, { [THREAD]: unlinked }, { [THREAD]: noPsid }]) {
      const { result, sendFetch } = await send(agent, THREAD, null, rows);
      expect(result).toEqual({ ok: false, code: "THREAD_NOT_FOUND" });
      expect(sendFetch).not.toHaveBeenCalled();
    }
  });

  it("tampered IDs cannot redirect the reply: a row for a different thread is rejected", () => {
    expect(authorizeReplyTarget(agent, { ...ownRow, id: OTHER_THREAD }, { threadId: THREAD })).toEqual({ ok: false, code: "THREAD_NOT_FOUND" });
    // Own lead ID paired with someone else's thread still fails.
    expect(authorizeReplyTarget(agent, { ...ownRow, id: OTHER_THREAD, assignedAgentId: OTHER }, { threadId: OTHER_THREAD, leadId: LEAD })).toEqual({ ok: false, code: "THREAD_NOT_FOUND" });
  });

  it("authorization runs before the release gate, so blocked gates never reveal thread existence", async () => {
    const { s, calls } = store({});
    const result = await guardedSendReply(
      { threadId: THREAD, text: "x", requestId: crypto.randomUUID(), staffConfirmed: true, actor: agent },
      { env: {}, store: s, gate: { ...allClear, syncEnabled: false } },
    );
    expect(result).toEqual({ ok: false, code: "THREAD_NOT_FOUND" });
    expect(calls.inserted).toHaveLength(0);
  });
});
