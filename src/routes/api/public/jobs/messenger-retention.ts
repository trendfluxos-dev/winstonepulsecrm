import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { MESSENGER_RETENTION_DAYS, retentionCutoff } from "@/lib/messenger-retention";

/**
 * Scheduled Messenger retention cleanup. Deletes only rows past the retention
 * window — the append-only trigger rejects anything newer, so a bug here
 * cannot erase recent history. Returns counts only, never content.
 */
export const Route = createFileRoute("/api/public/jobs/messenger-retention")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const deleted: Record<string, number> = {};

        const sweep = async (table: string, column: string, days: number, extra?: (q: any) => any) => {
          let query = supabaseAdmin
            .from(table as never)
            .delete({ count: "exact" } as never)
            .lt(column, retentionCutoff(days, now).toISOString());
          if (extra) query = extra(query);
          const { count, error } = await query;
          if (error) {
            // Missing table means nothing to clean; never pretend success.
            if (error.code === "42P01" || error.code === "42703") return 0;
            throw error;
          }
          return count ?? 0;
        };

        deleted["messages"] = await sweep("messenger_messages", "created_at", MESSENGER_RETENTION_DAYS.messages);
        deleted["threadEvents"] = await sweep("messenger_thread_events", "created_at", MESSENGER_RETENTION_DAYS.threadEvents);
        deleted["receipts"] = await sweep("messenger_webhook_receipts", "received_at", MESSENGER_RETENTION_DAYS.receipts);
        deleted["sentOutbox"] = await sweep("messenger_outbox", "created_at", MESSENGER_RETENTION_DAYS.sentOutbox, (q) =>
          q.not("sent_mid", "is", null),
        );

        return Response.json({ ok: true, deleted }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
