/**
 * Durable store behind the Messenger webhook. Server-only: reached through the
 * generated admin client inside the handler, never from browser code.
 *
 * A missing table is reported as `storage_unavailable`, which keeps the webhook
 * refusing with 503 — the pipeline never claims a message was stored when the
 * reviewed migration has not been applied.
 */
import type { MessengerStore, ReceiptClaim, StoredInbound } from "@/lib/messenger-ingest.server";
import type { ReviewStore, StoredMessage } from "@/lib/messenger-review.server";

/** Postgres codes that mean "the reviewed storage is not here yet". */
const MISSING_STORAGE_CODES = new Set(["42P01", "42703"]);

export function supabaseMessengerStore(): MessengerStore {
  return {
    async claimReceipt(eventKey, payloadHash): Promise<ReceiptClaim> {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("messenger_webhook_receipts" as never)
        .insert({ event_key: eventKey, payload_sha256: payloadHash } as never);
      if (!error) return { kind: "fresh" };
      if (MISSING_STORAGE_CODES.has(error.code ?? "")) return { kind: "storage_unavailable" };
      if (error.code !== "23505") throw error;
      const { data } = await supabaseAdmin
        .from("messenger_webhook_receipts" as never)
        .select("payload_sha256")
        .eq("event_key", eventKey)
        .maybeSingle();
      if (!data) throw error;
      return (data as { payload_sha256: string }).payload_sha256 === payloadHash
        ? { kind: "duplicate" }
        : { kind: "conflict" };
    },

    async recordInbound(input): Promise<StoredInbound> {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const at = new Date(Math.min(Math.max(input.timestamp, 0), 8.64e15)).toISOString();

      const { data: thread, error: threadError } = await supabaseAdmin
        .from("messenger_threads" as never)
        .upsert(
          { page_id: input.pageId, psid: input.psid, last_inbound_at: at, last_message_at: at } as never,
          { onConflict: "page_id,psid" },
        )
        .select("id")
        .maybeSingle();
      if (threadError) {
        if (MISSING_STORAGE_CODES.has(threadError.code ?? "")) return { ok: false, reason: "storage_unavailable" };
        throw threadError;
      }
      if (!thread) return { ok: false, reason: "storage_unavailable" };
      const threadId = (thread as { id: string }).id;

      const { data: message, error: messageError } = await supabaseAdmin
        .from("messenger_messages" as never)
        .insert({
          thread_id: threadId,
          mid: input.mid,
          direction: "inbound",
          body: input.text,
          created_at: at,
        } as never)
        .select("id")
        .maybeSingle();
      if (messageError) {
        if (MISSING_STORAGE_CODES.has(messageError.code ?? "")) return { ok: false, reason: "storage_unavailable" };
        if (messageError.code === "23505") return { ok: false, reason: "duplicate" };
        throw messageError;
      }
      if (!message) return { ok: false, reason: "storage_unavailable" };

      await supabaseAdmin
        .from("messenger_threads" as never)
        .update({ unread_count: (await unreadCount(supabaseAdmin, threadId)) } as never)
        .eq("id", threadId);

      return { ok: true, threadId, messageId: (message as { id: string }).id };
    },

    async recordStatus(input) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("messenger_thread_events" as never)
        .insert({
          thread_id: await threadIdFor(supabaseAdmin, input.pageId, input.psid),
          action: input.kind,
          detail: { event_key: input.eventKey, timestamp: input.timestamp } as never,
        } as never);
      if (error) {
        if (MISSING_STORAGE_CODES.has(error.code ?? "")) return { ok: false };
        throw error;
      }
      return { ok: true };
    },
  };
}

async function threadIdFor(db: { from: (t: never) => any }, pageId: string, psid: string): Promise<string | null> {
  const { data } = await db
    .from("messenger_threads" as never)
    .select("id")
    .eq("page_id", pageId)
    .eq("psid", psid)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function unreadCount(db: { from: (t: never) => any }, threadId: string): Promise<number> {
  const { count } = await db
    .from("messenger_messages" as never)
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId)
    .eq("direction", "inbound");
  return count ?? 0;
}

/**
 * Review store behind the staff confirmation step. Reads only the one message
 * the staff member is looking at; a missing table is reported as unreadable
 * rather than as "no such message", so the UI never claims a demo row is real.
 */
export function supabaseMessengerReviewStore(): ReviewStore {
  return {
    async loadMessage(messageId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("messenger_messages" as never)
        .select("id, thread_id, direction, body, lead_id, messenger_threads ( page_id, psid )")
        .eq("id", messageId)
        .maybeSingle();
      if (error) {
        if (MISSING_STORAGE_CODES.has(error.code ?? "")) return "unavailable";
        throw error;
      }
      if (!data) return null;
      const row = data as unknown as {
        id: string;
        thread_id: string;
        direction: string;
        body: string | null;
        lead_id: string | null;
        messenger_threads: { page_id: string; psid: string } | null;
      };
      const thread = row.messenger_threads;
      if (!thread) return null;
      const message: StoredMessage = {
        id: row.id,
        threadId: row.thread_id,
        pageId: thread.page_id,
        psid: thread.psid,
        direction: row.direction === "outbound" ? "outbound" : "inbound",
        body: row.body,
        leadId: row.lead_id,
      };
      return message;
    },

    async linkLead(messageId, leadId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("messenger_messages" as never)
        .update({ lead_id: leadId } as never)
        .eq("id", messageId)
        .is("lead_id", null);
      if (error) {
        if (MISSING_STORAGE_CODES.has(error.code ?? "")) return { ok: false };
        throw error;
      }
      return { ok: true };
    },
  };
}
