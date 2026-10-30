import { createFileRoute } from "@tanstack/react-router";

/** Hourly GitHub repository access watch; alerts HQ/IT on changes. Requires the cron secret. */
export const Route = createFileRoute("/api/public/hooks/github-access-watch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const header =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: stored } = await supabaseAdmin
          .from("system_settings")
          .select("value")
          .eq("key", "shift_cron_secret")
          .maybeSingle();
        const storedSecret =
          stored && typeof stored.value === "object" && stored.value !== null
            ? (stored.value as { secret?: string }).secret
            : undefined;
        const accepted = [process.env["SHIFT_CRON_SECRET"], process.env["LOVABLE_CRON_SECRET"], storedSecret].filter(
          (v): v is string => Boolean(v),
        );
        if (!header || !accepted.includes(header)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        try {
          const { runGithubAccessWatch } = await import("@/lib/github-access.server");
          return Response.json({ ok: true, ...(await runGithubAccessWatch()) });
        } catch (error) {
          console.error("github access watch failed");
          return Response.json({ error: "failed" }, { status: 500 });
        }
      },
    },
  },
});
