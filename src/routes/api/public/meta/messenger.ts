import { createFileRoute } from "@tanstack/react-router";

/**
 * Placeholder for the future Meta Messenger webhook. Facebook is not connected:
 * GET handshake remains disabled; POST checks signatures but never accepts messages.
 */
const notConnected = () =>
  Response.json({ ok: false, code: "FACEBOOK_NOT_CONNECTED", message: "Facebook not connected yet" }, { status: 503 });

export const Route = createFileRoute("/api/public/meta/messenger")({
  server: { handlers: {
    GET: async ({ request }) => {
      const url = new URL(request.url);
      const verification = [...url.searchParams.keys()].some((key) => key.startsWith("hub."));
      // Human navigation is not webhook verification: show the inbox,
      // not a deliberate 503 that the preview treats as a runtime failure.
      if (!verification && request.headers.get("accept")?.includes("text/html")) {
        return new Response(null, { status: 303, headers: { Location: "/messenger", "Cache-Control": "no-store" } });
      }
      return notConnected();
    },
    POST: async ({ request }) => {
      const { inspectSignedWebhook } = await import("@/lib/messenger-webhook.server");
      return inspectSignedWebhook(request, process.env["META_APP_SECRET"]);
    },
  } },
});
