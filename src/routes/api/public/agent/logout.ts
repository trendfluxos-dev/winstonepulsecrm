import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/agent/logout
 * Header: x-device-token
 *
 * Revokes ONLY the token presented by this phone (the one row whose hash
 * matches). Other devices of the same agent stay signed in. Idempotent: an
 * already revoked or unknown token returns 200 so a retried sign-out succeeds.
 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-device-token")?.trim();
        if (!token || token.length < 32) return json({ ok: true, revoked: false });
        const { hashToken } = await import("@/lib/device-auth.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("agent_devices")
          .update({ revoked_at: new Date().toISOString(), status: "revoked" })
          .eq("token_hash", await hashToken(token))
          .is("revoked_at", null)
          .select("id");
        if (error) return json({ error: "Sign-out could not be recorded", retryable: true }, 500);
        return json({ ok: true, revoked: (data?.length ?? 0) > 0 });
      },
    },
  },
});
