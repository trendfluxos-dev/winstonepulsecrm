/**
 * n8n → CRM lead intake webhook. Fail-closed: without N8N_PIPELINE_ENABLED
 * and N8N_WEBHOOK_SECRET every request is refused. Verified requests are
 * rate-limited, size-capped, HMAC-checked over the raw body, schema-validated,
 * idempotency-claimed, then stored through the canonical intake path.
 */
import { createFileRoute } from "@tanstack/react-router";
import { verifyOsRequest } from "@/lib/os-bridge";
import { createRateLimiter, requestSourceKey } from "@/lib/rate-limit";
import {
  N8N_MAX_BODY_BYTES,
  N8N_RATE_LIMIT_PER_MINUTE,
  n8nLeadPayloadSchema,
} from "@/lib/n8n-pipeline";
import { claimN8nReceipt, processN8nLead } from "@/lib/n8n-pipeline.server";

const limiter = createRateLimiter(N8N_RATE_LIMIT_PER_MINUTE, 60_000);

function refuse(status: number, code: string) {
  return Response.json({ ok: false, code }, { status });
}

export const Route = createFileRoute("/api/public/n8n/leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env["N8N_PIPELINE_ENABLED"] !== "true") return refuse(503, "PIPELINE_DISABLED");
        const secret = process.env["N8N_WEBHOOK_SECRET"];
        if (!secret) return refuse(503, "WEBHOOK_NOT_CONFIGURED");

        if (!limiter(requestSourceKey(request))) return refuse(429, "RATE_LIMITED");

        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > N8N_MAX_BODY_BYTES) {
          return refuse(413, "PAYLOAD_TOO_LARGE");
        }

        const failure = await verifyOsRequest({
          secret,
          rawBody,
          timestamp: request.headers.get("x-n8n-timestamp"),
          signature: request.headers.get("x-n8n-signature"),
          idempotencyKey: request.headers.get("x-n8n-event-id"),
        });
        if (failure) return refuse(401, failure.toUpperCase());

        let json: unknown;
        try {
          json = JSON.parse(rawBody);
        } catch {
          return refuse(400, "INVALID_JSON");
        }
        const parsed = n8nLeadPayloadSchema.safeParse(json);
        if (!parsed.success) return refuse(422, "INVALID_PAYLOAD");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const claim = await claimN8nReceipt({
          admin: supabaseAdmin,
          eventKey: parsed.data.event_id,
          rawBody,
        });
        if (claim === "duplicate") return Response.json({ ok: true, duplicate: true });
        if (claim === "conflict") return refuse(409, "EVENT_KEY_CONFLICT");

        const outcome = await processN8nLead({ admin: supabaseAdmin, payload: parsed.data });
        if (!outcome.ok) {
          const status = outcome.code === "INVALID_PHONE" ? 422 : 500;
          return refuse(status, outcome.code);
        }
        return Response.json({ ok: true, leadId: outcome.leadId, duplicate: outcome.duplicate });
      },
    },
  },
});
