import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Store-level regressions for the durable Messenger store. The admin client
 * is mocked so no database is touched; each test pins one failure mode.
 */

type Row = Record<string, unknown>;

const state = {
  thread: null as Row | null,
  insertedEvents: [] as Row[],
  nextError: null as { code: string; message: string } | null,
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "messenger_threads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: state.thread, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "messenger_thread_events") {
        return {
          insert: async (row: Row) => {
            if (state.nextError) return { error: state.nextError };
            state.insertedEvents.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

import { supabaseMessengerStore } from "@/lib/messenger-store.server";

const statusInput = {
  pageId: "page-1",
  psid: "user-1",
  kind: "delivery" as const,
  eventKey: "dlv:page-1:123",
  timestamp: 1761340000000,
};

describe("supabaseMessengerStore.recordStatus", () => {
  beforeEach(() => {
    state.thread = null;
    state.insertedEvents = [];
    state.nextError = null;
  });

  it("skips gracefully when the thread does not exist yet", async () => {
    const store = supabaseMessengerStore();
    const result = await store.recordStatus(statusInput);
    expect(result).toEqual({ ok: true });
    expect(state.insertedEvents).toHaveLength(0);
  });

  it("attaches the event when the thread exists", async () => {
    state.thread = { id: "thread-1" };
    const store = supabaseMessengerStore();
    const result = await store.recordStatus(statusInput);
    expect(result).toEqual({ ok: true });
    expect(state.insertedEvents).toHaveLength(1);
    expect(state.insertedEvents[0]?.["thread_id"]).toBe("thread-1");
  });

  it("reports storage_unavailable when the events table is missing", async () => {
    state.thread = { id: "thread-1" };
    state.nextError = { code: "42P01", message: "relation does not exist" };
    const store = supabaseMessengerStore();
    const result = await store.recordStatus(statusInput);
    expect(result).toEqual({ ok: false });
  });
});
