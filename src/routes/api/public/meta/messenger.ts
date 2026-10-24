import { createFileRoute } from "@tanstack/react-router";

/**
 * Placeholder for the future Meta Messenger webhook. Facebook is not connected:
 * no verify token, no signature secret, no processing, no database write.
 */
const notConnected = () =>
  Response.json({ ok: false, code: "FACEBOOK_NOT_CONNECTED", message: "Facebook not connected yet" }, { status: 503 });

export const Route = createFileRoute("/api/public/meta/messenger")({
  server: { handlers: {
    GET: async ({ request }) => {
      const url = new URL(request.url);
      const verification = [...url.searchParams.keys()].some((key) => key.startsWith("hub."));
      // Human navigation is not webhook verification: show the setup page,
      // not a deliberate 503 that the preview treats as a runtime failure.
      if (!verification && request.headers.get("accept")?.includes("text/html")) {
        return new Response(null, { status: 303, headers: { Location: "/messenger-setup", "Cache-Control": "no-store" } });
      }
      return notConnected();
    },
    POST: async () => notConnected(),
  } },
});
