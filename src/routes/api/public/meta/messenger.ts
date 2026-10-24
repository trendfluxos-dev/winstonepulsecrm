import { createFileRoute } from "@tanstack/react-router";

/**
 * Placeholder for the future Meta Messenger webhook. Facebook is not connected:
 * no verify token, no signature secret, no processing, no database write.
 */
const notConnected = () =>
  Response.json({ ok: false, code: "FACEBOOK_NOT_CONNECTED", message: "Facebook not connected yet" }, { status: 503 });

export const Route = createFileRoute("/api/public/meta/messenger")({
  server: { handlers: { GET: async () => notConnected(), POST: async () => notConnected() } },
});
