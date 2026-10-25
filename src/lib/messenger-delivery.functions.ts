import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { emptyDeliverySummary, summarizeDeliveryRows, type DeliverySummary } from "@/lib/messenger-delivery";

const Base = z.object({ adminToken: z.string().nullable().optional() });

/** Postgres codes that mean the durable tables are not readable here. */
const MISSING_STORAGE_CODES = new Set(["42P01", "42703"]);

export type DeliverySummaryResult =
  | { ok: true; summary: DeliverySummary }
  | { ok: false; code: "FORBIDDEN" | "UNAVAILABLE" };

/**
 * Read-only delivery diagnostics for /inbox: receipt processing, delivery /
 * read / postback counts, outbox retry state and the latest failure code.
 * Staff-only; aggregates and codes only, never message content. A storage
 * error is reported as not-ready, never as an empty history.
 */
export const getMessengerDeliverySummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input ?? {}))
  .handler(async ({ data }): Promise<DeliverySummaryResult> => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    const { messengerView } = await import("@/lib/messenger-shared");
    if (!messengerView(caller).canOpen) return { ok: false, code: "FORBIDDEN" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [receipts, events, outbox] = await Promise.all([
      supabaseAdmin.from("messenger_webhook_receipts" as never).select("received_at, processed_at"),
      supabaseAdmin.from("messenger_thread_events" as never).select("action, created_at"),
      supabaseAdmin.from("messenger_outbox" as never).select("sent_mid, last_error, created_at"),
    ]);
    for (const result of [receipts, events, outbox]) {
      if (result.error) {
        if (MISSING_STORAGE_CODES.has(result.error.code ?? "")) {
          return { ok: true, summary: emptyDeliverySummary(false) };
        }
        return { ok: false, code: "UNAVAILABLE" };
      }
    }

    return {
      ok: true,
      summary: summarizeDeliveryRows({
        receipts: (receipts.data ?? []) as never,
        events: (events.data ?? []) as never,
        outbox: (outbox.data ?? []) as never,
      }),
    };
  });
