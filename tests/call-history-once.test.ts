import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory sync_events markers + lead history; nothing reaches the database.
const s = vi.hoisted(() => ({
  markers: new Set<string>(),
  history: [] as Array<{ kind: string; lead_id: string }>,
  markerReadFails: false,
  historyWriteFails: false,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      let key = "";
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (_k: string, v: string) => { key = v; return chain; },
        maybeSingle: async () => s.markerReadFails
          ? { data: null, error: { message: "read failed" } }
          : { data: s.markers.has(key) ? { id: "m" } : null, error: null },
        insert: async (row: Record<string, unknown>) => {
          if (table === "sync_events") {
            const k = String(row.idempotency_key);
            if (s.markers.has(k)) return { error: { message: "duplicate key value" } };
            s.markers.add(k);
            return { error: null };
          }
          return { error: null };
        },
      };
      return chain;
    },
  },
}));
vi.mock("@/lib/lead-events.server", () => ({
  logLeadEvent: async (e: { kind: string; leadId: string }) => {
    if (s.historyWriteFails) throw new Error("history write failed");
    s.history.push({ kind: e.kind, lead_id: e.leadId });
  },
}));

import { logLeadEventOnce } from "@/lib/lead-events-once.server";

const LEAD = "11111111-1111-4111-8111-111111111111";
const started = (callUid: string) =>
  logLeadEventOnce({ onceKey: `call:${callUid}`, leadId: LEAD, agentId: "agent-a", kind: "call_started", detail: "x" });

beforeEach(() => { s.markers.clear(); s.history = []; s.markerReadFails = false; s.historyWriteFails = false; });

describe("call history entries are written once per physical call", () => {
  it("a retried request for the same call adds no second entry", async () => {
    expect((await started("and-abc-1")).logged).toBe(true);
    expect((await started("and-abc-1")).logged).toBe(false);
    expect((await started("and-abc-1")).logged).toBe(false);
    expect(s.history.filter((h) => h.kind === "call_started")).toHaveLength(1);
  });
  it("a different call to the same lead gets its own entry", async () => {
    await started("and-abc-1");
    await started("and-abc-2");
    expect(s.history).toHaveLength(2);
  });
  it("different kinds for the same call are each written once", async () => {
    await started("and-abc-1");
    await logLeadEventOnce({ onceKey: "call:and-abc-1", leadId: LEAD, kind: "call_ended" });
    await logLeadEventOnce({ onceKey: "call:and-abc-1", leadId: LEAD, kind: "call_ended" });
    expect(s.history.map((h) => h.kind)).toEqual(["call_started", "call_ended"]);
  });
  it("a failed history write leaves no marker, so the retry still writes it", async () => {
    s.historyWriteFails = true;
    await expect(started("and-abc-1")).rejects.toThrow();
    s.historyWriteFails = false;
    expect((await started("and-abc-1")).logged).toBe(true);
    expect(s.history).toHaveLength(1);
  });
  it("an unreadable marker skips the entry rather than risk a duplicate", async () => {
    s.markerReadFails = true;
    expect((await started("and-abc-1")).logged).toBe(false);
    expect(s.history).toHaveLength(0);
  });
});
