import { createFileRoute } from "@tanstack/react-router";

/**
 * Own-work reports feed for the Winstone Connect Android app.
 *
 * GET /api/public/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Header: x-device-token (per-agent). The shared server secret is refused.
 * Logic and scope rules live in src/lib/reports-summary.server.ts.
 */
export const Route = createFileRoute("/api/public/reports/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleReportsSummary, loadOwnReportData } = await import("@/lib/reports-summary.server");
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        return handleReportsSummary(request, {
          resolveCaller: resolveApiCaller,
          loadOwnData: loadOwnReportData,
        });
      },
    },
  },
});
