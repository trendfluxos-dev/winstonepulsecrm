import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Daily Firebase → @grpc/grpc-js advisory watch; alerts IT once a fix ships. Managed cron auth only. */
export const Route = createFileRoute("/api/public/jobs/firebase-grpc-watch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        try {
          const { runFirebaseGrpcWatch } = await import("@/lib/firebase-grpc-watch.server");
          return Response.json({ ok: true, ...(await runFirebaseGrpcWatch()) }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          console.error("firebase grpc watch failed");
          return Response.json({ ok: false, code: "WATCH_FAILED" }, { status: 500 });
        }
      },
    },
  },
});
