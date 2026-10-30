import { createFileRoute } from "@tanstack/react-router";

/**
 * Retired: this re-run endpoint had no phone or CRM caller and was reachable
 * only through the retired shared secret. Failed AI steps are retried by the
 * scheduled /api/public/ingest/analyze sweep. It refuses every request with no
 * fallback, before reading any body or data.
 */
function gone(): Response {
  return new Response(JSON.stringify({ error: "This endpoint has been retired" }), {
    status: 410,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/ingest/reprocess")({
  server: { handlers: { GET: gone, POST: gone } },
});
