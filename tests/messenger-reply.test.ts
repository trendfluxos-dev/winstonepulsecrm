import { describe, expect, it, vi } from "vitest";

import { evaluateReplyGate, REPLY_BLOCKERS } from "@/lib/messenger-reply-gate";
import { guardedSendReply, type ReplyStore } from "@/lib/messenger-reply.server";

const allClear = {
  appSecretConfigured: true,
  pageTokenConfigured: true,
  pageIdConfigured: true,
  allTracksVerified: true,
  syncEnabled: true,
};

const AGENT = "00000000-0000-4000-8000-0000000000a1";
const THREAD = "00000000-0000-4000-8000-0000000000t1".replace("t1", "01");
const LEAD = "00000000-0000-4000-8000-0000000000l1".replace("l1", "02");
const actor = { scope: "agent" as const, readOnly: false, userId: "u-agent", profileId: AGENT };
const input = { threadId: THREAD, leadId: LEAD, text: "synthetic reply", requestId: crypto.randomUUID(), staffConfirmed: true, actor };

function fakeStore(psid: string | null = "PSID_SYNTHETIC") {
  const calls = { inserted: 0, sent: 0, failed: 0 };
  const store: ReplyStore = {
    async getReplyTarget(id) {
      return psid === null ? null : { id, psid, leadId: LEAD, assignedAgentId: AGENT, lead: { assigned_to: AGENT, assigned_agent_id: AGENT } };
    },
    async insertOutbox() { calls.inserted += 1; return "outbox-1"; },
    async markSent() { calls.sent += 1; },
    async markFailed() { calls.failed += 1; },
  };
  return { store, calls };
}

describe("evaluateReplyGate — every blocker must clear", () => {
  it("refuses when secrets are missing", () => {
    const gate = evaluateReplyGate({ ...allClear, appSecretConfigured: false, pageTokenConfigured: false, pageIdConfigured: false, staffConfirmed: true });
    expect(gate).toEqual({ ok: false, blockers: ["app_secret", "page_token", "page_id"] });
  });

  it("refuses without verified tracks, sync enable or staff confirmation", () => {
    const gate = evaluateReplyGate({ ...allClear, allTracksVerified: false, syncEnabled: false, staffConfirmed: false });
    expect(gate).toEqual({ ok: false, blockers: ["verification", "sync_disabled", "no_staff_confirm"] });
  });

  it("passes only when everything is clear", () => {
    expect(evaluateReplyGate({ ...allClear, staffConfirmed: true })).toEqual({ ok: true });
  });

  it("blocker labels are bilingual and secret-free", () => {
    for (const label of Object.values(REPLY_BLOCKERS)) {
      expect(label.bn.length).toBeGreaterThan(0);
      expect(label.en.length).toBeGreaterThan(0);
      expect(`${label.bn} ${label.en}`).not.toMatch(/bearer|authorization/i);
    }
  });
});

describe("guardedSendReply — nothing leaves while blocked", () => {
  it("refuses with blockers and never touches the outbox or network", async () => {
    const { store, calls } = fakeStore();
    const sendFetch = vi.fn();
    const result = await guardedSendReply(input, {
      env: {},
      store,
      gate: { ...allClear, allTracksVerified: false },
      sendFetch: sendFetch as never,
    });
    expect(result).toEqual({ ok: false, blockers: ["verification"] });
    expect(calls.inserted).toBe(0);
    expect(sendFetch).not.toHaveBeenCalled();
  });

  it("refuses without explicit staff confirmation even when everything else is clear", async () => {
    const { store, calls } = fakeStore();
    const sendFetch = vi.fn();
    const result = await guardedSendReply({ ...input, staffConfirmed: false }, {
      env: {},
      store,
      gate: allClear,
      sendFetch: sendFetch as never,
    });
    expect(result).toEqual({ ok: false, blockers: ["no_staff_confirm"] });
    expect(calls.inserted).toBe(0);
    expect(sendFetch).not.toHaveBeenCalled();
  });

  it("refuses an unknown thread without sending", async () => {
    const { store, calls } = fakeStore(null);
    const sendFetch = vi.fn();
    const result = await guardedSendReply(input, {
      env: { META_PAGE_ID: "p", META_PAGE_ACCESS_TOKEN: "synthetic" },
      store,
      gate: allClear,
      sendFetch: sendFetch as never,
    });
    expect(result).toEqual({ ok: false, code: "THREAD_NOT_FOUND" });
    expect(calls.inserted).toBe(0);
    expect(sendFetch).not.toHaveBeenCalled();
  });

  it("queues then sends when the gate is fully clear, recording the provider message id", async () => {
    const { store, calls } = fakeStore();
    const sendFetch = vi.fn(async () => new Response(JSON.stringify({ message_id: "mid_synthetic" }), { status: 200 }));
    const result = await guardedSendReply(input, {
      env: { META_PAGE_ID: "page1", META_PAGE_ACCESS_TOKEN: "synthetic-token" },
      store,
      gate: allClear,
      sendFetch: sendFetch as never,
    });
    expect(result).toEqual({ ok: true, sentMid: "mid_synthetic" });
    expect(calls.inserted).toBe(1);
    expect(calls.sent).toBe(1);
    expect(calls.failed).toBe(0);
    // The token reaches only the provider endpoint, never the result.
    expect(JSON.stringify(result)).not.toContain("synthetic-token");
  });

  it("records a generic failure code on provider refusal — never the error body", async () => {
    const { store, calls } = fakeStore();
    const sendFetch = vi.fn(async () => new Response("provider detail that must not leak", { status: 400 }));
    const result = await guardedSendReply(input, {
      env: { META_PAGE_ID: "page1", META_PAGE_ACCESS_TOKEN: "synthetic-token" },
      store,
      gate: allClear,
      sendFetch: sendFetch as never,
    });
    expect(result).toEqual({ ok: false, code: "SEND_FAILED" });
    expect(calls.failed).toBe(1);
    expect(JSON.stringify(result)).not.toContain("provider detail");
  });

  it("records NETWORK on transport errors", async () => {
    const { store, calls } = fakeStore();
    const sendFetch = vi.fn(async () => { throw new Error("boom"); });
    const result = await guardedSendReply(input, {
      env: { META_PAGE_ID: "page1", META_PAGE_ACCESS_TOKEN: "synthetic-token" },
      store,
      gate: allClear,
      sendFetch: sendFetch as never,
    });
    expect(result).toEqual({ ok: false, code: "SEND_FAILED" });
    expect(calls.failed).toBe(1);
  });
});
