import { createFileRoute } from "@tanstack/react-router";

/**
 * Meta Messenger webhook. GET answers Meta's subscription handshake only when
 * the server-side verify token is configured and matches exactly; POST checks
 * raw-byte signatures and stores messages only while the ingestion switch is
 * on. Human browser navigation still redirects to the inbox.
 */
const notConnected = () =>
  Response.json({ ok: false, code: "FACEBOOK_NOT_CONNECTED", message: "Facebook not connected yet" }, { status: 503 });

export const Route = createFileRoute("/api/public/meta/messenger")({
  server: { handlers: {
    GET: async ({ request }) => {
      const url = new URL(request.url);
      const verification = [...url.searchParams.keys()].some((key) => key.startsWith("hub."));
      if (verification) {
        const token = process.env["META_WEBHOOK_VERIFY_TOKEN"];
        if (!token) return notConnected();
        const { webhookChallenge } = await import("@/lib/messenger-protocol.server");
        const challenge = webhookChallenge(url.searchParams, token);
        if (!challenge) {
          return Response.json({ ok: false, code: "INVALID_VERIFY_TOKEN" }, { status: 403, headers: { "Cache-Control": "no-store" } });
        }
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
      }
      // Human navigation is not webhook verification: show the inbox,
      // not a deliberate 503 that the preview treats as a runtime failure.
      if (request.headers.get("accept")?.includes("text/html")) {
        return new Response(null, { status: 303, headers: { Location: "/messenger", "Cache-Control": "no-store" } });
      }
      return notConnected();
    },
    POST: async ({ request }) => {
      const { inspectSignedWebhook } = await import("@/lib/messenger-webhook.server");
      // Ingestion needs both the env switch AND a latest audit-log "enable"
      // decision (which itself requires all verification tracks verified).
      // Fail closed: any lookup error keeps ingestion off.
      const { messengerIngestionEnabled } = await import("@/lib/messenger-ingest.server");
      let enabled = messengerIngestionEnabled();
      if (enabled) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("messenger_sync_decisions" as never)
            .select("action")
            .order("created_at", { ascending: false })
            .limit(1);
          enabled = Array.isArray(data) && (data[0] as { action?: string } | undefined)?.action === "enable";
        } catch {
          enabled = false;
        }
      }
      return inspectSignedWebhook(request, process.env["META_APP_SECRET"], { enabled });
    },
  } },
});
