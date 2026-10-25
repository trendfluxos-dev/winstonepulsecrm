/**
 * Guarded Messenger reply/outbox path. The gate (messenger-reply-gate) is
 * evaluated from real server state first; only when every blocker is cleared
 * does this write a pending outbox row and attempt the Meta Send API call.
 * The page token is read from the server environment inside the handler and
 * is never logged, returned, or stored. Provider error bodies are never
 * read — only the HTTP status becomes a generic failure code.
 */
import { evaluateReplyGate, type ReplyBlockerId, type ReplyGateInput } from "@/lib/messenger-reply-gate";

export type ReplyStore = {
  /** Resolve the thread's recipient (PSID); null when the thread is unknown. */
  getThreadPsid(threadId: string): Promise<string | null>;
  /** Insert a pending outbox row; returns its id. */
  insertOutbox(row: { requestId: string; threadId: string; body: string; createdBy: string | null }): Promise<string>;
  markSent(outboxId: string, sentMid: string): Promise<void>;
  markFailed(outboxId: string, code: string): Promise<void>;
};

export type GuardedReplyResult =
  | { ok: true; sentMid: string }
  | { ok: false; blockers: ReplyBlockerId[] }
  | { ok: false; code: "THREAD_NOT_FOUND" | "SEND_FAILED" | "OUTBOX_UNAVAILABLE" };

/** Presence-only secret flags plus verification/sync state. Fail-closed. */
export async function gatherReplyGateState(env: Record<string, string | undefined>): Promise<Omit<ReplyGateInput, "staffConfirmed">> {
  const state = {
    appSecretConfigured: Boolean(env["META_APP_SECRET"]),
    pageTokenConfigured: Boolean(env["META_PAGE_ACCESS_TOKEN"]),
    pageIdConfigured: Boolean(env["META_PAGE_ID"]),
    allTracksVerified: false,
    syncEnabled: false,
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: tracks }, { data: decisions }] = await Promise.all([
      supabaseAdmin
        .from("meta_verification_records" as never)
        .select("track, outcome, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("messenger_sync_decisions" as never)
        .select("action")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const latest = new Map<string, string>();
    for (const row of (tracks ?? []) as unknown as { track: string; outcome: string }[]) {
      if (!latest.has(row.track)) latest.set(row.track, row.outcome);
    }
    state.allTracksVerified =
      ["app_review", "live_mode", "page_consent", "messages_subscription"].every((t) => latest.get(t) === "verified");
    state.syncEnabled =
      Array.isArray(decisions) && (decisions[0] as { action?: string } | undefined)?.action === "enable";
  } catch {
    // Any lookup error keeps the gate closed.
  }
  return state;
}

/**
 * Evaluate the gate, then — only when it passes — queue and attempt the send.
 * `sendFetch` is injectable so tests never touch the network.
 */
export async function guardedSendReply(
  input: { threadId: string; text: string; requestId: string; staffConfirmed: boolean; actorProfileId: string | null },
  deps: {
    env: Record<string, string | undefined>;
    store: ReplyStore;
    gate?: Omit<ReplyGateInput, "staffConfirmed">;
    sendFetch?: typeof fetch;
  },
): Promise<GuardedReplyResult> {
  const gateState = deps.gate ?? (await gatherReplyGateState(deps.env));
  const gate = evaluateReplyGate({ ...gateState, staffConfirmed: input.staffConfirmed });
  if (!gate.ok) return { ok: false, blockers: gate.blockers };

  const psid = await deps.store.getThreadPsid(input.threadId);
  if (!psid) return { ok: false, code: "THREAD_NOT_FOUND" };

  let outboxId: string;
  try {
    outboxId = await deps.store.insertOutbox({
      requestId: input.requestId,
      threadId: input.threadId,
      body: input.text,
      createdBy: input.actorProfileId,
    });
  } catch {
    return { ok: false, code: "OUTBOX_UNAVAILABLE" };
  }

  const pageId = deps.env["META_PAGE_ID"] as string;
  const token = deps.env["META_PAGE_ACCESS_TOKEN"] as string;
  const send = deps.sendFetch ?? fetch;
  try {
    const res = await send(`https://graph.facebook.com/v21.0/${pageId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text: input.text },
        messaging_type: "RESPONSE",
      }),
    });
    if (!res.ok) {
      // Status only — the provider error body can echo request data.
      await deps.store.markFailed(outboxId, `HTTP_${res.status}`);
      return { ok: false, code: "SEND_FAILED" };
    }
    const payload = (await res.json()) as { message_id?: string };
    const sentMid = typeof payload.message_id === "string" ? payload.message_id : "unknown";
    await deps.store.markSent(outboxId, sentMid);
    return { ok: true, sentMid };
  } catch {
    await deps.store.markFailed(outboxId, "NETWORK");
    return { ok: false, code: "SEND_FAILED" };
  }
}

/** Live store backed by the durable Messenger tables. */
export function supabaseReplyStore(): ReplyStore {
  return {
    async getThreadPsid(threadId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("messenger_threads" as never)
        .select("psid")
        .eq("id", threadId)
        .maybeSingle();
      return ((data as { psid?: string } | null)?.psid as string) ?? null;
    },
    async insertOutbox(row) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("messenger_outbox" as never)
        .insert({
          request_id: row.requestId,
          thread_id: row.threadId,
          body: row.body,
          created_by: row.createdBy,
          attempts: 0,
        } as never)
        .select("id")
        .single();
      if (error || !data) throw new Error("outbox insert failed");
      return (data as { id: string }).id;
    },
    async markSent(outboxId, sentMid) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("messenger_outbox" as never).update({ sent_mid: sentMid } as never).eq("id", outboxId);
    },
    async markFailed(outboxId, code) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("messenger_outbox" as never).update({ last_error: code } as never).eq("id", outboxId);
    },
  };
}
