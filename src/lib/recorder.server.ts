import {
  MAX_VOICE_NOTE_BYTES,
  MIN_VOICE_NOTE_BYTES,
  contentTypeFor,
  extensionForMime,
  normaliseInsight,
  type RecorderInsight,
} from "@/lib/recorder-shared";

/**
 * One voice-note pipeline for the web Recorder page and the Winstone phone app:
 * upload -> transcribe -> AI summary (never invented) -> recorder_insights row.
 * Callers must have already verified the agent and the 9:05 briefing.
 */
const SYSTEM = `You summarise real-estate sales calls and voice notes for Winstone (Bangladesh).
Use ONLY what is in the transcript; never invent names, prices, dates or promises.
Reply in the transcript's language (Bengali if mixed).
Return JSON: {"title": short title, "summary": 2-4 sentences, "takeaways": [up to 5 short points], "action_items": [up to 5 concrete next steps, empty if none]}.`;

export async function storeVoiceNote(agentId: string, bytes: Uint8Array, mimeType: string, durationSeconds: number) {
  if (bytes.byteLength < MIN_VOICE_NOTE_BYTES) throw new Error("Recording too short — please record again");
  if (bytes.byteLength > MAX_VOICE_NOTE_BYTES) throw new Error("Recording too long — keep notes under ~10 minutes");

  const ext = extensionForMime(mimeType);
  const contentType = contentTypeFor(ext);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const path = `voice-notes/${agentId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabaseAdmin.storage.from("call-audio").upload(path, bytes, { contentType });
  if (up.error) throw new Error("Could not save the audio");

  const { transcribeWithAdapter } = await import("@/lib/stt-provider.server");
  const stt = await transcribeWithAdapter(bytes, `note.${ext}`, contentType);
  const transcript = stt.status === "failed" ? "" : stt.transcript.trim();

  let insight: RecorderInsight | null = null;
  let errorMessage: string | null = stt.status === "failed" ? (stt.errorMessage ?? "Transcription failed") : null;
  if (transcript) {
    try {
      const { aiChatJson } = await import("@/lib/ai-model.server");
      insight = normaliseInsight(await aiChatJson<unknown>({ system: SYSTEM, user: transcript.slice(0, 24_000) }));
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : "AI summary failed";
    }
  } else if (!errorMessage) errorMessage = "No speech was heard in this recording";

  const { data: row, error } = await supabaseAdmin
    .from("recorder_insights")
    .insert({
      agent_id: agentId,
      source: "voice",
      storage_path: path,
      mime_type: contentType,
      duration_seconds: durationSeconds,
      transcript: transcript || null,
      title: insight?.title || null,
      summary: insight?.summary || null,
      takeaways: insight?.takeaways ?? [],
      action_items: insight?.actionItems ?? [],
      status: insight ? "ready" : "failed",
      error_message: errorMessage,
    })
    .select("id")
    .single();
  if (error) throw new Error("Could not save the voice note");
  return { id: row.id, ok: Boolean(insight), error: errorMessage };
}
