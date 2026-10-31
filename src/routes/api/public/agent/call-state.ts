import { lifecyclePatch, recordingAvailability } from "@/lib/call-reconciliation";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Call lifecycle contract for the Android companion.
 *
 * initiated -> ringing -> answered -> completed (or failed / no_answer).
 *
 * The phone owns a `call_uid` it generates before dialling and reuses for every
 * state push of the same call. That id lands in `external_call_id`, which is
 * uniquely indexed, so an offline replay or a WorkManager retry updates the same
 * row instead of creating a second call. Nothing here claims a recording: when
 * the device cannot record, `recording_status` is written as `not_available` and
 * the mandatory report flow continues untouched.
 *
 * State and duration here are pushed by the agent's device and include ringing
 * time, so rows created here are labelled `android_dialer` (live dialer): they
 * never count as phone-measured and cannot set `connection_verified`. Only the
 * phone's own call-log sync ("log-…" ids) or a stored recording proves a call.
 */
const Body = z.object({
  // "log-…" ids are reserved for rows read from the phone's system call log,
  // which the server treats as phone-measured. A live state push may not claim one.
  call_uid: z
    .string()
    .trim()
    .min(6)
    .max(120)
    .refine((v) => !v.toLowerCase().startsWith("log-"), "reserved call id prefix"),
  lead_id: z.string().uuid(),
  state: z.enum(["initiated", "ringing", "answered", "completed", "failed", "no_answer"]),
  at: z.string().datetime({ offset: true }).optional(),
  duration_seconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .optional(),
  agent_phone: z.string().trim().min(5).max(20).nullable().optional(),
  recording_supported: z.boolean().optional(),
  recording_note: z.string().trim().max(300).nullable().optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/call-state")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid payload" }, 400);
        const body = parsed.data;
        const at = body.at ?? new Date().toISOString();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { leadNotAssignedTo, LEAD_NOT_YOURS } = await import("@/lib/lead-access.server");

        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("id, phone_number, assigned_to, assigned_agent_id")
          .eq("id", body.lead_id)
          .maybeSingle();
        if (!lead) return json({ error: "Unknown lead" }, 404);
        // Calls may only be logged on a lead assigned to this agent —
        // unassigned pool leads are LeadHub-only and must not gain call history.
        if (leadNotAssignedTo(lead, caller.profile.id)) {
          return json({ error: LEAD_NOT_YOURS }, 403);
        }

        // recording_status is honest: only the upload endpoint may set
        // "available" once real audio is stored.
        const recordingStatus =
          body.recording_supported === false
            ? "not_available"
            : body.state === "completed"
              ? "pending"
              : "unknown";

        const patch = {
          call_status: body.state,
          agent_phone: body.agent_phone ?? caller.profile.phone ?? null,
          recording_status: recordingStatus,
          ...(body.state === "initiated" ? { started_at: at } : {}),
          ...(body.state === "answered" ? { answered_at: at } : {}),
          ...(body.state === "completed" || body.state === "failed" || body.state === "no_answer"
            ? { finished_at: at }
            : {}),
          ...(body.duration_seconds !== undefined
            ? { duration_seconds: body.duration_seconds }
            : {}),
        };

        const { data: existing } = await supabaseAdmin
          .from("call_recordings")
          .select("id, call_status, agent_id, lead_id, storage_path, audio_url, upload_status, recording_status, call_source, external_call_id")
          .eq("external_call_id", body.call_uid)
          .maybeSingle();
        // A call record may only be updated by the agent who owns it, for the same lead.
        if (existing && (existing.agent_id !== caller.profile.id || existing.lead_id !== body.lead_id)) {
          return json({ error: "This call record belongs to another agent or lead" }, 403);
        }

        const { isPhoneMeasuredCall } = await import("@/lib/call-duration");
        const lifecycle: Partial<typeof patch> & { call_status: string; recording_status: string } =
          existing ? lifecyclePatch(existing, patch) : patch;
        // A live state push must never rewrite the measured time of a row that
        // came from the phone's call log or recorder.
        const { duration_seconds: pushedDuration, ...withoutDuration } = lifecycle;
        const acceptedPatch =
          existing && isPhoneMeasuredCall(existing) ? withoutDuration : { ...withoutDuration, ...(pushedDuration !== undefined ? { duration_seconds: pushedDuration } : {}) };
        let recordingId = existing?.id ?? null;

        if (existing) {
          await supabaseAdmin.from("call_recordings").update(acceptedPatch).eq("id", existing.id);
        } else {
          const { data: inserted, error } = await supabaseAdmin
            .from("call_recordings")
            .insert({
              lead_id: lead.id,
              agent_id: caller.profile.id,
              device_id: caller.device.id,
              phone_number: lead.phone_number,
              call_direction: "outgoing",
              duration_seconds: body.duration_seconds ?? 0,
              is_two_sided: false,
              sync_status: "uploaded",
              analysis_status: "pending",
              // Live dialer state, not a phone-measured call (see header).
              call_source: "android_dialer",
              external_call_id: body.call_uid,
              upload_status: "pending",
              ...patch,
            })
            .select("id")
            .single();
          // A concurrent duplicate is a replay, not a failure: read it back.
          if (error) {
            const { data: raced } = await supabaseAdmin
              .from("call_recordings")
              .select("id, agent_id, lead_id")
              .eq("external_call_id", body.call_uid)
              .maybeSingle();
            if (!raced) return json({ error: "Call reconciliation failed" }, 500);
            if (raced.agent_id !== caller.profile.id || raced.lead_id !== body.lead_id) return json({ error: "Call identity conflict" }, 409);
            recordingId = raced.id;
          } else {
            recordingId = inserted?.id ?? null;
          }
        }

        const { recordSyncEvent } = await import("@/lib/call-jobs.server");
        await recordSyncEvent({
          agentId: caller.profile.id,
          deviceId: caller.device.id,
          eventType: `call_${body.state}`,
          entityType: "call_recording",
          entityId: recordingId,
          idempotencyKey: `call_state:${body.call_uid}:${body.state}`,
          payload: {
            lead_id: lead.id,
            recording_supported: body.recording_supported ?? null,
            recording_note: body.recording_note ?? null,
          },
        });

        if (body.state === "initiated") {
          const { logLeadEvent } = await import("@/lib/lead-events.server");
          await logLeadEvent({
            leadId: lead.id,
            agentId: caller.profile.id,
            kind: "call_started",
            detail: `${caller.profile.name} কল শুরু করেছেন`,
          });
        }

        // Every finished call is reportable — answered, unanswered or failed.
        // Opened here on the server so the report exists even if the phone never
        // gets to send its own "open report" request.
        let reportId: string | null = null;
        if (body.state === "completed" || body.state === "no_answer" || body.state === "failed") {
          await supabaseAdmin.from("leads").update({ last_call_at: at }).eq("id", lead.id);
          const { openCallReport } = await import("@/lib/call-reports.server");
          const report = await openCallReport({
            leadId: lead.id,
            agentId: caller.profile.id,
            recordingId,
            deviceId: caller.device.id,
            phoneNumber: lead.phone_number,
            durationSeconds: body.duration_seconds ?? 0,
            connected: body.state === "completed",
          });
          reportId = report.id;
        }

        return json({
          ok: true,
          call_uid: body.call_uid,
          recording_id: recordingId,
          report_id: reportId,
          call_status: body.state,
          recording_status: existing ? recordingAvailability({ ...existing, ...acceptedPatch }) : recordingStatus,
        });
      },
    },
  },
});
