import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { normaliseInsight, voiceNoteStage, type RecorderInsight } from "@/lib/recorder-shared";

/**
 * Recorder page: the agent's call recordings (captured by the Winstone Android
 * app) and mic voice notes (any phone, incl. iPhone), each with transcript,
 * AI summary, key takeaways and action items. Agents see only their own work;
 * authority sees everything read-only. Rows live in server-only recorder_insights.
 */

const Token = z.object({ adminToken: z.string().optional().nullable() });

async function workCaller(adminToken?: string | null) {
  const { resolveWorkCaller } = await import("@/lib/access.server");
  const caller = await resolveWorkCaller(adminToken ?? null);
  if (caller.scope === "none") throw new Error("Please sign in to use the Recorder");
  return caller;
}

const SYSTEM = `You summarise real-estate sales calls and voice notes for Winstone (Bangladesh).
Use ONLY what is in the transcript; never invent names, prices, dates or promises.
Reply in the transcript's language (Bengali if mixed).
Return JSON: {"title": short title, "summary": 2-4 sentences, "takeaways": [up to 5 short points], "action_items": [up to 5 concrete next steps, empty if none]}.`;

async function buildInsight(transcript: string): Promise<RecorderInsight> {
  const { aiChatJson } = await import("@/lib/ai-model.server");
  const raw = await aiChatJson<unknown>({ system: SYSTEM, user: transcript.slice(0, 24_000) });
  return normaliseInsight(raw);
}

export const listRecorderHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.parse(input ?? {}))
  .handler(async ({ data }) => {
    const me = await workCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const own = me.scope === "agent" || me.scope === "coordinator";
    if (own && !me.profile?.id) throw new Error("Your staff profile is not ready yet");

    let calls = supabaseAdmin
      .from("call_recordings")
      .select("id, agent_id, phone_number, call_direction, duration_seconds, transcription_text, ai_summary, recorder_source, created_at, storage_path, audio_url")
      .order("created_at", { ascending: false })
      .limit(60);
    let notes = supabaseAdmin
      .from("recorder_insights")
      .select("id, agent_id, source, recording_id, duration_seconds, title, transcript, summary, takeaways, action_items, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(120);
    if (own) {
      calls = calls.eq("agent_id", me.profile!.id);
      notes = notes.eq("agent_id", me.profile!.id);
    }
    const [c, n] = await Promise.all([calls, notes]);
    if (c.error || n.error) throw new Error("Recorder history is unavailable");

    const byRecording = new Map((n.data ?? []).filter((r) => r.recording_id).map((r) => [r.recording_id!, r]));
    const items = [
      ...(c.data ?? []).map((r) => {
        const ins = byRecording.get(r.id);
        return {
          id: r.id,
          kind: "call" as const,
          createdAt: r.created_at,
          durationSeconds: r.duration_seconds ?? 0,
          title: ins?.title || r.phone_number || "Call",
          phone: r.phone_number,
          direction: r.call_direction,
          hasAudio: Boolean(r.storage_path || r.audio_url),
          source: r.recorder_source,
          transcript: r.transcription_text ?? null,
          summary: ins?.summary || r.ai_summary || null,
          takeaways: (ins?.takeaways as string[] | undefined) ?? [],
          actionItems: (ins?.action_items as string[] | undefined) ?? [],
          insightReady: Boolean(ins),
        };
      }),
      ...(n.data ?? []).filter((r) => r.source === "voice").map((r) => ({
        id: r.id,
        kind: "voice" as const,
        createdAt: r.created_at,
        durationSeconds: r.duration_seconds,
        title: r.title || "Voice note",
        phone: null as string | null,
        direction: null as string | null,
        hasAudio: true,
        source: "mic",
        transcript: r.transcript,
        summary: r.summary,
        takeaways: (r.takeaways as string[]) ?? [],
        actionItems: (r.action_items as string[]) ?? [],
        insightReady: r.status === "ready",
        stage: voiceNoteStage(r),
        error: r.error_message,
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, readOnly: me.readOnly };
  });

export const saveVoiceNote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Token.extend({
      audioBase64: z.string().min(64).max(20_000_000),
      mimeType: z.string().max(60),
      durationSeconds: z.number().int().min(1).max(3600),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await workCaller(data.adminToken);
    const { requireWrite } = await import("@/lib/access.server");
    requireWrite(me);
    if (!me.profile?.id) throw new Error("Your staff profile is not ready yet");
    const { assertBriefingForCaller } = await import("@/lib/agent-briefing.server");
    await assertBriefingForCaller(me);

    const bytes = Uint8Array.from(atob(data.audioBase64), (ch) => ch.charCodeAt(0));
    const { storeVoiceNote } = await import("@/lib/recorder.server");
    return storeVoiceNote(me.profile.id, bytes, data.mimeType, data.durationSeconds);
  });

export const retryVoiceNoteFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const me = await workCaller(data.adminToken);
    const { requireWrite } = await import("@/lib/access.server");
    requireWrite(me);
    if (!me.profile?.id) throw new Error("Your staff profile is not ready yet");
    const { assertBriefingForCaller } = await import("@/lib/agent-briefing.server");
    await assertBriefingForCaller(me);
    const { retryVoiceNote } = await import("@/lib/recorder.server");
    return retryVoiceNote(me.profile.id, data.id);
  });

export const buildCallInsight = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.extend({ recordingId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const me = await workCaller(data.adminToken);
    const { requireWrite } = await import("@/lib/access.server");
    requireWrite(me);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rec, error } = await supabaseAdmin
      .from("call_recordings")
      .select("id, agent_id, transcription_text")
      .eq("id", data.recordingId)
      .maybeSingle();
    if (error || !rec) throw new Error("Recording not found");
    if (me.scope !== "authority" && rec.agent_id !== me.profile?.id) throw new Error("This recording belongs to another agent");
    if (!rec.agent_id) throw new Error("This recording has no agent");
    const transcript = rec.transcription_text?.trim();
    if (!transcript) throw new Error("No transcript yet — the call audio has not been transcribed");

    const insight = await buildInsight(transcript);
    const { error: upErr } = await supabaseAdmin.from("recorder_insights").upsert(
      {
        agent_id: rec.agent_id,
        source: "call",
        recording_id: rec.id,
        title: insight.title || null,
        summary: insight.summary || null,
        takeaways: insight.takeaways,
        action_items: insight.actionItems,
        status: "ready",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "recording_id" },
    );
    if (upErr) throw new Error("Could not save the summary");
    return insight;
  });

export const getRecorderPlayback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.extend({ id: z.string().uuid(), kind: z.enum(["call", "voice"]) }).parse(input))
  .handler(async ({ data }) => {
    const me = await workCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q =
      data.kind === "voice"
        ? await supabaseAdmin.from("recorder_insights").select("agent_id, storage_path").eq("id", data.id).maybeSingle()
        : await supabaseAdmin.from("call_recordings").select("agent_id, lead_id, storage_path, audio_url").eq("id", data.id).maybeSingle();
    const row = q.data as { agent_id: string; lead_id?: string | null; storage_path: string | null; audio_url?: string | null } | null;
    if (!row) throw new Error("Recording not found");
    const { hasFullRecordingAccess } = await import("@/lib/recording-access");
    const mustOwn = !hasFullRecordingAccess(me);
    if (mustOwn && row.agent_id !== me.profile?.id) throw new Error("This recording belongs to another agent");
    // Call audio also needs the lead to still be this agent's (moved lead = no access).
    if (mustOwn && data.kind === "call") {
      const { assertAssignedLead } = await import("@/lib/assigned-lead-scope.server");
      await assertAssignedLead(me.profile?.id ?? "", row.lead_id ?? null);
    }
    const path = data.kind === "call" ? row.audio_url || row.storage_path : row.storage_path;
    if (!path) throw new Error("This recording has no audio");
    const { data: signed, error } = await supabaseAdmin.storage.from("call-audio").createSignedUrl(path, 2 * 60);
    if (error || !signed) throw new Error("Could not create playback link");
    return { url: signed.signedUrl };
  });
