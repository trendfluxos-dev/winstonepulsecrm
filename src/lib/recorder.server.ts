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

  const result = await transcribeAndSummarise(bytes, ext, contentType, null);
  const { data: row, error } = await supabaseAdmin
    .from("recorder_insights")
    .insert({
      agent_id: agentId,
      source: "voice",
      storage_path: path,
      mime_type: contentType,
      duration_seconds: durationSeconds,
      ...result.fields,
    })
    .select("id")
    .single();
  if (error) throw new Error("Could not save the voice note");
  return { id: row.id, ok: result.ok, error: result.error };
}

/** Transcribes (unless a transcript already exists) and summarises; returns the row fields to store. */
async function transcribeAndSummarise(bytes: Uint8Array, ext: string, contentType: string, existing: string | null) {
  let transcript = existing?.trim() ?? "";
  let errorMessage: string | null = null;
  if (!transcript) {
    const { transcribeWithAdapter } = await import("@/lib/stt-provider.server");
    const stt = await transcribeWithAdapter(bytes, `note.${ext}`, contentType);
    if (stt.status === "failed") errorMessage = stt.errorMessage ?? "Transcription failed";
    else transcript = stt.transcript.trim();
    if (!transcript && !errorMessage) errorMessage = "No speech was heard in this recording";
  }
  let insight: RecorderInsight | null = null;
  if (transcript) {
    try {
      const { aiChatJson } = await import("@/lib/ai-model.server");
      insight = normaliseInsight(await aiChatJson<unknown>({ system: SYSTEM, user: transcript.slice(0, 24_000) }));
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : "AI summary failed";
    }
  }
  return {
    ok: Boolean(insight),
    error: errorMessage,
    fields: {
      transcript: transcript || null,
      title: insight?.title || null,
      summary: insight?.summary || null,
      takeaways: insight?.takeaways ?? [],
      action_items: insight?.actionItems ?? [],
      status: insight ? "ready" : "failed",
      error_message: errorMessage,
    },
  };
}

/**
 * Retries a failed voice note from its already-saved audio: re-transcribes only
 * when the transcript is missing, then rebuilds the summary. Own notes only.
 */
export async function retryVoiceNote(agentId: string, id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("recorder_insights")
    .select("id, agent_id, source, storage_path, mime_type, transcript, status")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.agent_id !== agentId || row.source !== "voice") throw new Error("Voice note not found");
  if (row.status === "ready") return { id, ok: true, error: null };
  if (!row.storage_path) throw new Error("This voice note has no saved audio");
  const file = await supabaseAdmin.storage.from("call-audio").download(row.storage_path);
  if (file.error || !file.data) throw new Error("Could not read the saved audio");
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  const ext = row.storage_path.split(".").pop() || "webm";
  const result = await transcribeAndSummarise(bytes, ext, row.mime_type || contentTypeFor(ext), row.transcript);
  const { error } = await supabaseAdmin
    .from("recorder_insights")
    .update({ ...result.fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("Could not save the retry");
  return { id, ok: result.ok, error: result.error };
}
