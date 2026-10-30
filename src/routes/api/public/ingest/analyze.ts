import { createFileRoute } from "@tanstack/react-router";

/**
 * Sweeps the transcription / AI analysis queue.
 *
 * Safe to call repeatedly: each recording carries its own state and attempt
 * count, so a sweep only picks up rows that are still pending or retryable.
 * Callable only by the managed scheduler with x-cron-secret
 * (LOVABLE_CRON_SECRET / SHIFT_CRON_SECRET / stored schedule secret).
 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/ingest/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronHeader = request.headers.get("x-cron-secret") ?? "";

        // The database scheduler signs with the shared secret stored in
        // settings, the same one the shift-summary schedule uses.
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

        const accepted = [
          process.env["LOVABLE_CRON_SECRET"],
          process.env["SHIFT_CRON_SECRET"],
          storedSecret,
        ].filter((value): value is string => Boolean(value));
        const cronOk = Boolean(cronHeader) && accepted.includes(cronHeader);
        if (!cronOk) return json({ error: "Unauthorized" }, 401);

        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 5), 1), 20);

        const { analyzePending } = await import("@/lib/analysis-queue.server");
        const results = await analyzePending(limit);
        return json({ ok: true, processed: results.length, results });
      },
    },
  },
});
