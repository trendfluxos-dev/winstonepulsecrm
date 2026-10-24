import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Recorder screen in the Winstone phone app (device token only, own notes only).
 * GET              -> the agent's voice notes, newest first
 * GET ?play=<id>   -> 2-minute playback link for one of the agent's own notes
 * POST             -> { audio_base64, mime_type, duration_seconds } saves a voice note
 * POST { retry_id } -> retries transcript/summary for one of the agent's failed notes
 */
const Retry = z.object({ retry_id: z.string().uuid() });
const Body = z.object({
  audio_base64: z.string().min(64).max(20_000_000),
  mime_type: z.string().max(60),
  duration_seconds: z.number().int().min(1).max(3600),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/recorder")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);
        const agentId = caller.profile.id;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const play = new URL(request.url).searchParams.get("play");
        if (play) {
          if (!z.string().uuid().safeParse(play).success) return json({ error: "Invalid id" }, 400);
          const { data: row } = await supabaseAdmin
            .from("recorder_insights")
            .select("agent_id, storage_path")
            .eq("id", play)
            .maybeSingle();
          if (!row || row.agent_id !== agentId || !row.storage_path) return json({ error: "Not found" }, 404);
          const { data: signed, error } = await supabaseAdmin.storage
            .from("call-audio")
            .createSignedUrl(row.storage_path, 2 * 60);
          if (error || !signed) return json({ error: "Playback unavailable" }, 500);
          return json({ url: signed.signedUrl });
        }

        const { data, error } = await supabaseAdmin
          .from("recorder_insights")
          .select("id, duration_seconds, title, transcript, summary, takeaways, action_items, status, error_message, created_at")
          .eq("agent_id", agentId)
          .eq("source", "voice")
          .order("created_at", { ascending: false })
          .limit(60);
        if (error) return json({ error: "Recorder history is unavailable" }, 500);
        const { voiceNoteStage } = await import("@/lib/recorder-shared");
        return json({ notes: (data ?? []).map((n) => ({ ...n, stage: voiceNoteStage(n) })) });
      },

      POST: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);
        const raw = await request.json().catch(() => null);
        const { requireAgentBriefing } = await import("@/lib/agent-briefing.server");
        const block = await requireAgentBriefing(caller.profile.id);
        if (block) return json({ error: block.reason, briefing: block.briefing }, 423);

        const retry = Retry.safeParse(raw);
        if (retry.success) {
          try {
            const { retryVoiceNote } = await import("@/lib/recorder.server");
            return json(await retryVoiceNote(caller.profile.id, retry.data.retry_id));
          } catch (e) {
            return json({ error: e instanceof Error ? e.message : "Retry failed" }, 400);
          }
        }
        const parsed = Body.safeParse(raw);
        if (!parsed.success) return json({ error: "Invalid recording" }, 400);

        try {
          const bytes = Uint8Array.from(atob(parsed.data.audio_base64), (ch) => ch.charCodeAt(0));
          const { storeVoiceNote } = await import("@/lib/recorder.server");
          return json(
            await storeVoiceNote(caller.profile.id, bytes, parsed.data.mime_type, parsed.data.duration_seconds),
          );
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Could not save the voice note" }, 400);
        }
      },
    },
  },
});
