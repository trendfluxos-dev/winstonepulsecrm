import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SYNC_ERROR_KINDS, SYNC_FAILURE_EVENT, SYNC_ITEM_KINDS } from "@/lib/android-sync-failures";

/**
 * Sync-failure reports from Winstone Connect (2.22+).
 *
 * POST /api/public/agent/sync-failures   Header: x-device-token
 * Body: { failures: [{ id, item_kind, error_kind, http_status?, attempts, count, permanent, call_ref?, first_at, last_at }] }
 *
 * The agent and device come from the token, never the body. Only technical
 * fields are accepted (no numbers, names, message text or tokens; call_ref is a
 * 12-hex fingerprint). Stored once per (device, report id) in sync_events, so a
 * phone re-sending the same batch never duplicates rows.
 */
const Failure = z.object({
  id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  item_kind: z.enum(SYNC_ITEM_KINDS),
  error_kind: z.enum(SYNC_ERROR_KINDS),
  http_status: z.number().int().min(0).max(599).nullable().optional(),
  attempts: z.number().int().min(0).max(9999),
  count: z.number().int().min(1).max(9999),
  permanent: z.boolean(),
  call_ref: z.string().regex(/^[a-f0-9]{12}$/).nullable().optional(),
  first_at: z.string().datetime({ offset: true }),
  last_at: z.string().datetime({ offset: true }),
});
const Body = z.object({ failures: z.array(Failure).min(1).max(50) });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/sync-failures")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid payload" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rows = parsed.data.failures.map((f) => ({
          agent_id: caller.profile.id,
          device_id: caller.device.id,
          idempotency_key: `${SYNC_FAILURE_EVENT}:${caller.device.id}:${f.id}`,
          event_type: SYNC_FAILURE_EVENT,
          entity_type: "agent_device",
          entity_id: caller.device.id,
          status: "failed",
          payload: {
            item_kind: f.item_kind,
            error_kind: f.error_kind,
            http_status: f.http_status ?? null,
            attempts: f.attempts,
            count: f.count,
            permanent: f.permanent,
            call_ref: f.call_ref ?? null,
            first_at: new Date(f.first_at).toISOString(),
            last_at: new Date(f.last_at).toISOString(),
          },
          processed_at: new Date().toISOString(),
        }));
        // Re-sent ids hit the unique idempotency key and are skipped, not duplicated.
        const { error } = await supabaseAdmin
          .from("sync_events")
          .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
        if (error) return json({ error: "Could not store sync failures", retryable: true }, 500);
        return json({ ok: true, accepted: rows.length });
      },
    },
  },
});
