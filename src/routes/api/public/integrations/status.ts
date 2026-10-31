import { createFileRoute } from "@tanstack/react-router";

/**
 * Retired: this public path used to list which integration secrets were set.
 * Secret presence is not public information; integration readiness lives in
 * the IT Console behind the full IT PIN. The path now reveals nothing.
 */
const gone = () =>
  Response.json({ error: "gone" }, { status: 410, headers: { "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/integrations/status")({
  server: { handlers: { GET: gone } },
});
