import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Post-call outcome from the Android live call screen.
 *
 * POST /api/public/ingest/outcome
 * Header: x-device-token (per-agent; the agent comes from the token)
 * Body: { lead_id, outcome, notes?, connected?, call_uid? } (agent_id ignored)
 *
 * Moves the lead to the right stage, appends the agent's in-call notes and
 * bumps the attempt counter so the web queue matches the phone instantly.
 */
const OUTCOME_STAGE = {
  interested: "contacted",
  follow_up: "follow_up",
  not_interested: "closed",
  wrong_number: "closed",
  no_answer: "pending",
} as const;

const Body = z.object({
  lead_id: z.string().uuid(),
  agent_id: z.string().uuid().optional(),
  outcome: z.enum(["interested", "follow_up", "not_interested", "wrong_number", "no_answer"]),
  notes: z.string().max(4000).optional(),
  connected: z.boolean().optional(),
  /** Stable id generated once per call on the phone and reused on every retry. */
  call_uid: z.string().trim().min(8).max(80).regex(/^[A-Za-z0-9._:-]+$/).optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/ingest/outcome")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        const parsed = Body.safeParse(raw);
        if (!parsed.success) {
          return json({ error: "Invalid payload", issues: parsed.error.issues }, 400);
        }
        const { lead_id, outcome, notes, connected, call_uid } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { leadNotAssignedTo, LEAD_NOT_YOURS } = await import("@/lib/lead-access.server");
        const { requireAgentBriefing } = await import("@/lib/agent-briefing.server");
        const briefingBlock = await requireAgentBriefing(caller.profile.id);
        if (briefingBlock) return json(briefingBlock, 409);

        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("id, notes, call_attempts, assigned_to, assigned_agent_id")
          .eq("id", lead_id)
          .maybeSingle();
        if (!lead) return json({ error: "Unknown lead" }, 404);
        // Strict: only a lead assigned to this agent (unassigned or conflicting owners refused).
        if (leadNotAssignedTo(lead, caller.profile.id)) {
          return json({ error: LEAD_NOT_YOURS }, 403);
        }

        if (call_uid) {
          // Idempotent per agent + call_uid: retries return the first result and
          // never append notes, attempts or timeline events twice.
          const { data, error } = await supabaseAdmin.rpc("apply_phone_outcome_atomic", {
            _agent: caller.profile.id, _lead: lead_id, _call_uid: call_uid, _outcome: outcome,
            _status: OUTCOME_STAGE[outcome], _notes: notes?.trim() ?? "", _connected: connected === true,
          });
          if (error) {
            if (/another lead/.test(error.message)) return json({ error: "call_uid already used for another lead" }, 409);
            if (/not assigned/.test(error.message)) return json({ error: LEAD_NOT_YOURS }, 403);
            return json({ error: "Outcome could not be saved", retryable: true }, 500);
          }
          return json({ ...(data as Record<string, unknown>), idempotent: true });
        }

        // Legacy payload (older app, no call_uid): applied once as before, but
        // flagged non-idempotent so the phone/IT know retries may duplicate.
        const stamp = new Date();
        const trimmed = notes?.trim();
        const appended = trimmed
          ? `${lead.notes ? `${lead.notes}\n\n` : ""}[${stamp.toISOString().slice(0, 16).replace("T", " ")}] ${trimmed}`
          : lead.notes;

        const { error } = await supabaseAdmin
          .from("leads")
          .update({
            status: OUTCOME_STAGE[outcome],
            outcome_category: outcome,
            notes: appended,
            call_attempts: (lead.call_attempts ?? 0) + 1,
            last_call_at: stamp.toISOString(),
            ...(connected === true ? { is_verified: true } : {}),
          })
          .eq("id", lead_id);
        if (error) return json({ error: error.message }, 500);

        const { logLeadEvent } = await import("@/lib/lead-events.server");
        await logLeadEvent({
          leadId: lead_id,
          agentId: caller.profile.id,
          kind: "outcome_logged",
          detail: `কলের ফল: ${outcome.replace(/_/g, " ")}`,
        });

        return json({
          ok: true,
          lead_id,
          status: OUTCOME_STAGE[outcome],
          outcome,
          server_time: stamp.toISOString(),
          idempotent: false,
          legacy: true,
        });
      },
    },
  },
});
