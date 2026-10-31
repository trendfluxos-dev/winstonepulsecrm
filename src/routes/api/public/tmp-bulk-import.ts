import { createFileRoute } from "@tanstack/react-router";

/**
 * Retired: the one-off 27 Sep 2026 head-office import is finished. Imports
 * now go through the reviewed file intake in the CRM, so this path refuses
 * every request and never touches lead data.
 */
const gone = () =>
  Response.json({ error: "gone" }, { status: 410, headers: { "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/tmp-bulk-import")({
  server: { handlers: { GET: gone, POST: gone } },
});
