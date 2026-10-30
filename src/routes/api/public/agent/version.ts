import { createFileRoute } from "@tanstack/react-router";

/**
 * Update check for the Android app.
 *
 * The phone sends its own versionCode and gets back the latest published
 * release. Nothing is ever installed silently: the app only shows a dismissible
 * (or, when `mandatory` is true, a blocking) update prompt that opens the
 * existing APK download route.
 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/version")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const current = Number(url.searchParams.get("version_code") ?? 0);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: latest } = await supabaseAdmin
          .from("app_releases")
          .select("version_code, version_name, is_mandatory")
          .order("version_code", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latest) return json({ update_available: false, latest: null });

        return json({
          update_available: latest.version_code > current,
          mandatory: latest.version_code > current && latest.is_mandatory,
          download_url: "/api/public/download/apk",
          // Public check: only version numbers, never internal release notes.
          latest: { version_code: latest.version_code, version_name: latest.version_name },
        });
      },
    },
  },
});
