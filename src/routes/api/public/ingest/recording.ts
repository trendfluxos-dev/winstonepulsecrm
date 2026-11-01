import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Call recording upload from the Winstone Connect Android app.
 *
 * Authentication: `x-device-token` only (per-device, bound to one agent
 * profile). There is no shared-secret path.
 *
 * Audio is stored first and answered immediately; transcription + AI analysis
 * run afterwards through the durable queue (`analysis_status` on the row, swept
 * by /api/public/ingest/analyze), so a long call never holds the request open.
 *
 * Idempotency: `client_upload_id` is unique, so a WorkManager retry can never
 * create a second recording for the same file.
 */
const Payload = z.object({
  lead_id: z.string().uuid().optional(),
  phone_number: z.string().min(5).optional(),
  agent_id: z.string().uuid().nullable().optional(),
  employee_id: z.string().min(2).max(20).nullable().optional(),
  /** The SIM the call was actually made from. */
  sim_number: z.string().trim().max(25).nullable().optional(),
  lead_name: z.string().trim().min(1).max(120).nullable().optional(),
  call_uid: z.string().trim().min(6).max(120).nullable().optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  client_upload_id: z.string().trim().min(6).max(120).nullable().optional(),
  /** phone_recorder = file saved by the phone's own call recorder, picked up after the call. */
  recorder_source: z.enum(["voice_call", "mic", "phone_recorder", "unknown"]).default("unknown"),
  audio_base64: z.string().min(1).max(33_000_000),
  file_extension: z.string().min(1).max(5).default("mp3"),
  duration_seconds: z.number().int().min(0),
  call_started_at: z.string().datetime({ offset: true }).nullable().optional(),
  call_direction: z.enum(["outgoing", "incoming_callback"]).default("outgoing"),
  is_two_sided: z.boolean().default(false),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

/** Multipart (preferred) or JSON+base64, so older builds keep working. */
async function readPayload(request: Request) {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return Payload.safeParse(await request.json().catch(() => null));
  }

  const form = await request.formData().catch(() => null);
  if (!form) return Payload.safeParse(null);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Payload.safeParse(null);
  if (file.size > MAX_AUDIO_BYTES) return { success: false as const, error: null, oversize: true };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  };
  const nameParts = (file.name || "recording.m4a").split(".");
  const ext = text("file_extension") ?? (nameParts.length > 1 ? (nameParts.pop() ?? "m4a") : "m4a");

  return Payload.safeParse({
    lead_id: text("lead_id"),
    phone_number: text("phone_number"),
    agent_id: text("agent_id"),
    employee_id: text("employee_id"),
    sim_number: text("sim_number"),
    lead_name: text("lead_name"),
    call_uid: text("call_uid"),
    checksum: text("checksum"),
    client_upload_id: text("client_upload_id"),
    recorder_source: text("recorder_source") ?? "unknown",
    audio_base64: toBase64(bytes),
    file_extension: ext.slice(0, 5),
    duration_seconds: Number(text("duration_seconds") ?? 0),
    call_started_at: text("call_started_at"),
    call_direction: text("call_direction") ?? "outgoing",
    is_two_sided: text("is_two_sided") === "true",
  });
}

export const Route = createFileRoute("/api/public/ingest/recording")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const parsed = await readPayload(request);
        if (!parsed.success) {
          if ("oversize" in parsed) return json({ error: "Audio file too large" }, 413);
          return json({ error: "Invalid payload" }, 400);
        }
        const body = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { ingestRecording } = await import("@/lib/call-intel.server");
        const { resolveLeadId } = await import("@/lib/ingest-resolve.server");
        const { bindAgentSim, simMatchesAgent } =
          await import("@/lib/agent-sim.server");

        let agent: { id: string } | null = null;
        if (caller.kind === "device") {
          // The SIM the call came from must belong to this desk.
          const simCheck = await simMatchesAgent({
            profileId: caller.profile.id,
            sim: body.sim_number ?? null,
          });
          if (!simCheck.ok) return json({ error: simCheck.reason }, 409);
          // First sync from an unbound SIM binds it to this desk.
          if (body.sim_number) {
            await bindAgentSim({
              profileId: caller.profile.id,
              sim: body.sim_number,
              deviceId: caller.device.id,
            });
          }
          agent = { id: caller.profile.id };
        }

        const { leadId, invalidPhone } = await resolveLeadId({
          leadId: body.lead_id ?? null,
          phoneNumber: body.phone_number ?? null,
          agentId: agent?.id ?? null,
          source: "call",
          fallbackName: body.lead_name ?? null,
        });
        if (invalidPhone)
          return json({ error: "সঠিক বাংলাদেশি মোবাইল নম্বর দিন", code: "invalid_phone" }, 422);
        if (!leadId) return json({ error: "Unknown lead" }, 404);

        // Ownership is never moved by a sync: a lead already held by another
        // agent stays with them; unheld leads require LeadHub assignment.
        if (agent?.id) {
          const { data: leadOwner } = await supabaseAdmin
            .from("leads")
            .select("id, assigned_to, assigned_agent_id")
            .eq("id", leadId)
            .maybeSingle();
          const { leadOwnerId } = await import("@/lib/lead-access.server");
          const conflicting = Boolean(leadOwner?.assigned_to && leadOwner?.assigned_agent_id && leadOwner.assigned_to !== leadOwner.assigned_agent_id);
          const ownerId = conflicting ? "conflict" : leadOwnerId(leadOwner);
          if (ownerId && ownerId !== agent.id) {
            return json(
              { error: "এই লিড অন্য এজেন্টের কাছে আছে — কল সিংক করা যাবে না", lead_id: leadId },
              409,
            );
          }
          if (!ownerId) return json({ error: "LeadHub assignment required", code: "unassigned_lead" }, 409);
        }


        try {
          const recordingId = await ingestRecording({
            leadId,
            agentId: agent?.id ?? null,
            audioBase64: body.audio_base64,
            fileExtension: body.file_extension,
            durationSeconds: body.duration_seconds,
            direction: body.call_direction,
            isTwoSided: body.is_two_sided,
            clientUploadId: body.client_upload_id ?? null,
            callUid: body.call_uid ?? null,
            expectedChecksum: body.checksum ?? null,
            callStartedAt: body.call_started_at ?? null,
            recorderSource: body.recorder_source,
            deviceId: caller.device.id,
          });

          // A retried upload reuses the stored audio; it must not add a second
          // "recording saved" entry, and the response says it was a duplicate.
          const { logLeadEventOnce } = await import("@/lib/lead-events-once.server");
          const savedEvent = await logLeadEventOnce({
            onceKey: `recording:${recordingId}`,
            deviceId: caller.device.id,
            leadId,
            agentId: agent?.id ?? null,
            recordingId,
            kind: "recording_saved",
            detail: body.is_two_sided
              ? "দুই পক্ষের অডিও (ডিভাইস অনুমোদন করেছে)"
              : "এক পক্ষের অডিও — এই ফোনে কল অডিও পাওয়া যায়নি",
          });

          // Only observed lifecycle evidence may open a connected-call report.
          const lifecycle = await supabaseAdmin.from("call_recordings").select("call_status, duration_seconds, started_at").eq("id", recordingId).single();
          if (lifecycle.error) throw new Error("Call evidence unavailable");
          if (agent?.id && lifecycle.data && ["completed", "no_answer", "failed"].includes(lifecycle.data.call_status ?? "")) {
            const { openCallReport } = await import("@/lib/call-reports.server");
            await openCallReport({
              leadId,
              agentId: agent.id,
              recordingId,
              deviceId: caller.device.id,
              phoneNumber: body.phone_number ?? null,
              callStartedAt: lifecycle.data.started_at,
              durationSeconds: lifecycle.data.duration_seconds,
              connected: lifecycle.data.call_status === "completed",
            });
          }

          // The durable analysis queue is swept separately. Upload confirmation must
          // not depend on an AI/Drive request or create additional billing on replay.
          const saved = await supabaseAdmin.from("call_recordings").select("checksum, upload_status, analysis_status").eq("id", recordingId).single();
          if (saved.error || !saved.data) throw new Error("Stored audio confirmation unavailable");
          return json({ duplicate: !savedEvent.logged, recording_id: recordingId, upload_status: saved.data.upload_status, checksum: saved.data.checksum, analysis: saved.data.analysis_status }, 202);
        } catch (error) {
          console.error("[ingest] recording failed", error);
          const conflict = error instanceof Error && ["CALL_IDENTITY_CONFLICT", "AUDIO_CHECKSUM_CONFLICT", "AUDIO_CONTENT_ALREADY_LINKED"].includes(error.message);
          return json({ error: conflict ? "Call identity or audio checksum does not match; original audio retained" : "Recording could not be stored", code: conflict ? "audio_identity_conflict" : "audio_store_failed" }, conflict ? 409 : 500);
        }
      },
    },
  },
});
