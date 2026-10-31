import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";
import { createRateLimiter, requestSourceKey } from "@/lib/rate-limit";

// Flood brake; 503 (not 429) so the gateway retries instead of dropping a delivery.
const whatsappLimiter = createRateLimiter(600, 60_000);

/**
 * WhatsApp Business connector callbacks (forwarded and signed by Lovable).
 * Every verified delivery is stored first in whatsapp_webhook_events, then
 * processed; failures return 5xx so the delivery is retried.
 */
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!whatsappLimiter(requestSourceKey(request))) return new Response("busy", { status: 503 });
        const secret = process.env.WHATSAPP_API_KEY;
        if (!secret) return new Response("not configured", { status: 503 });
        const deliveryId = request.headers.get("x-lovable-delivery")?.trim() ?? "";
        const event = request.headers.get("x-lovable-event")?.trim() ?? "";
        let payload: unknown;
        try {
          ({ payload } = await verifyWebhookRequest({ req: request, secret, maxBodyBytes: 4 * 1024 * 1024 }));
        } catch {
          return new Response("unauthorized", { status: 401 });
        }
        if (!deliveryId || !event || deliveryId.length > 200 || event.length > 100) {
          return new Response("missing delivery headers", { status: 400 });
        }
        const { receiveWebhook } = await import("@/lib/agent-whatsapp.server");
        const ok = await receiveWebhook(deliveryId, event, payload);
        return ok ? new Response("ok") : new Response("retry", { status: 500 });
      },
    },
  },
});
