import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Hourly GitHub repository access watch; alerts HQ/IT on changes. Managed cron auth only. */
export const Route = createFileRoute("/api/public/jobs/github-access-watch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        try {
          const { runGithubAccessWatch } = await import("@/lib/github-access.server");
          return Response.json({ ok: true, ...(await runGithubAccessWatch()) }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          console.error("github access watch failed");
          return Response.json({ ok: false, code: "WATCH_FAILED" }, { status: 500 });
        }
      },
    },
  },
});
