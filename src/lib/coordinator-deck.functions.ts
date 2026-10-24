import { selectAssignmentCandidates, assertPreviewUnchanged } from "@/lib/assignment-preview";
import { MAX_DAILY_LEADS_PER_AGENT } from "@/lib/lead-quota";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/** Gmail-signed-in user enters the Coordinator PIN; returns a deck-only token. */
export const unlockCoordinatorDeck = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ pin: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(null);
    if (!caller.userId) return { ok: false as const, reason: "signin" as const };
    // Approved agent/HQ accounts keep their own access — this shortcut never widens them.
    if (caller.scope !== "none") return { ok: false as const, reason: "account" as const };
    const gate = await import("@/lib/coordinator-gate.server");
    const email = await gate.googleEmailFor(caller.userId);
    if (!email) return { ok: false as const, reason: "gmail" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await supabaseAdmin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "coordinator_pin_failed")
      .eq("entity_id", caller.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_FAILS) return { ok: false as const, reason: "locked" as const };

    const { logAudit } = await import("@/lib/audit.server");
    if (!gate.coordinatorPinMatches(data.pin)) {
      await logAudit({
        action: "coordinator_pin_failed",
        entityType: "coordinator_deck",
        entityId: caller.userId,
        actorLabel: email,
      });
      return { ok: false as const, reason: "pin" as const };
    }
    await logAudit({
      action: "coordinator_pin_unlocked",
      entityType: "coordinator_deck",
      entityId: caller.userId,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: email,
    });
    return { ok: true as const, token: gate.mintCoordinatorToken(caller.userId), email };
  });

/** Is this device's deck token still good for the signed-in user? */
export const coordinatorDeckStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, deckAccess } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    return { deck: deckAccess(caller), signedIn: Boolean(caller.userId), label: caller.label ?? caller.profile?.name ?? null };
  });

async function fullDeck(adminToken: string | null | undefined) {
  const { requireLeadHub } = await import("@/lib/access.server");
  await requireLeadHub(adminToken);
  return { caller: { profile: null, label: "LeadHub Nexus" } };
}

/** Available pool + each active approved agent's allocation today. */
export const coordinatorAllocation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    await fullDeck(data.adminToken);
    const pool = await import("@/lib/lead-pool.server");
    const today = pool.dhakaToday();
    const { isDistributionDay, FRIDAY_BLOCK_MESSAGE } = await import("@/lib/business-day");
    const distributionOpen = isDistributionDay(today);
    const [available, agents, held, plan] = await Promise.all([
      pool.usablePoolCount(),
      pool.activeAgents(),
      pool.assignedTodayByAgent(today),
      pool.dailyPlan(),
    ]);
    return {
      today,
      distributionOpen,
      distributionNotice: distributionOpen ? null : FRIDAY_BLOCK_MESSAGE,
      available,
      perAgent: plan.perAgent,
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        employeeId: a.employee_id,
        today: held.get(a.id) ?? 0,
      })),
    };
  });

const BatchInput = z.object({
  adminToken: z.string().nullable().optional(),
  requestId: z.string().uuid(),
  reviewedLeadIds: z.array(z.string().uuid()).max(2000).optional(),
  rows: z
    .array(z.object({ agentId: z.string().uuid(), count: z.number().int().min(1).max(MAX_DAILY_LEADS_PER_AGENT) }))
    .min(1)
    .max(40),
}).superRefine((value, ctx) => {
  const ids = value.rows.map((row) => row.agentId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "একই এজেন্ট একাধিকবার দেওয়া যাবে না", path: ["rows"] });
});

/** Read-only proposal. No reservation, audit writes, rollover or automatic distribution. */
async function buildAssignmentPreview(rows: Array<{ agentId: string; count: number }>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pool = await import("@/lib/lead-pool.server");
  const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
  const agents = new Map((await pool.activeAgents()).map(a => [a.id, a]));
  const today = pool.dhakaToday(); const held = await pool.assignedTodayByAgent(today); const plan = await pool.dailyPlan();
  const taken = await pool.assignedPhoneKeys();
  const candidates: import("@/lib/assignment-preview").PreviewLead[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const page = await supabaseAdmin.from("leads").select("id, name, phone_number, created_at")
      .is("assigned_to", null).is("assigned_agent_id", null).eq("status", "pending")
      .or("assignment_source.is.null,assignment_source.neq.duplicate_skipped")
      .order("created_at").order("id").range(offset, offset + 999);
    if (page.error) throw new Error(page.error.message);
    candidates.push(...(page.data ?? [])); if ((page.data ?? []).length < 1000) break;
  }
  const eligible = new Set(await eligibleLeadIds(candidates.map(l => l.id)));
  const { extractBangladeshPhones } = await import("@/lib/lead-phone");
  const proposals = rows.map(row => {
    const agent = agents.get(row.agentId);
    const capacity = agent ? Math.max(0, plan.perAgent - (held.get(row.agentId) ?? 0)) : 0;
    const leads = selectAssignmentCandidates(candidates, eligible, taken, Math.min(row.count, capacity));
    leads.forEach(l => { eligible.delete(l.id); extractBangladeshPhones(l.phone_number ?? "").forEach(k => taken.add(k)); });
    return { agentId: row.agentId, name: agent?.name ?? null, requested: row.count, capacity, leads };
  });
  return { today, generatedAt: new Date().toISOString(), scanned: candidates.length, truncated: candidates.length >= 20000, proposals };
}
export const previewLeadCounts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BatchInput.parse(input))
  .handler(async ({ data }) => {
    await fullDeck(data.adminToken);
    const { assertDistributionDay } = await import("@/lib/business-day"); assertDistributionDay();
    return buildAssignmentPreview(data.rows);
  });

/**
 * Assigns up to the requested number of oldest eligible unassigned leads to each
 * agent. Idempotent per requestId, guarded so a lead can reach only one agent,
 * never touches leads already assigned, and never exceeds the 50/day plan.
 */
export const assignLeadCounts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BatchInput.parse(input))
  .handler(async ({ data }) => {
    const { caller } = await fullDeck(data.adminToken);
    const { assertDistributionDay } = await import("@/lib/business-day");
    assertDistributionDay();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pool = await import("@/lib/lead-pool.server");
    const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
    const { logAudit } = await import("@/lib/audit.server");

    // Same requestId already ran (double click / retry) → return that result.
    const { data: prior, error: priorError } = await supabaseAdmin
      .from("audit_logs")
      .select("metadata")
      .eq("action", "lead_assigned")
      .contains("metadata", { requestId: data.requestId });
    if (priorError) throw new Error("Assignment replay history unavailable");
    if (prior && prior.length) {
      const results = prior.map((p) => {
        const m = (p.metadata ?? {}) as { agentId?: string; count?: number; requested?: number };
        return { agentId: m.agentId ?? "", requested: m.requested ?? 0, assigned: m.count ?? 0 };
      });
      return { replay: true, results, available: await pool.usablePoolCount() };
    }

    if (!data.reviewedLeadIds) throw new Error("Review a lead preview before assignment");
    const preview = await buildAssignmentPreview(data.rows);
    assertPreviewUnchanged(data.reviewedLeadIds, preview.proposals.flatMap(p => p.leads.map(l => l.id)));
    const agents = new Map((await pool.activeAgents()).map((a) => [a.id, a]));
    const today = pool.dhakaToday();
    const held = await pool.assignedTodayByAgent(today);
    const plan = await pool.dailyPlan();
    const results: { agentId: string; requested: number; assigned: number }[] = [];

    for (const row of data.rows) {
      const agent = agents.get(row.agentId);
      if (!agent) {
        results.push({ agentId: row.agentId, requested: row.count, assigned: 0 });
        continue;
      }
      const capacity = Math.max(0, plan.perAgent - (held.get(agent.id) ?? 0));
      const targetCount = Math.min(row.count, capacity);
      let moved: string[] = [];
      const proposal = preview.proposals.find(p => p.agentId === row.agentId);
      const ids = (proposal?.leads ?? []).slice(0, targetCount).map(l => l.id);
      if (ids.length) {
        const { data: updated, error: updateError } = await supabaseAdmin.from("leads")
          .update({ assigned_to: agent.id, assigned_agent_id: agent.id, assignment_source: "leadhub", work_date: today })
          .in("id", ids).is("assigned_to", null).is("assigned_agent_id", null).select("id");
        if (updateError) throw new Error(updateError.message);
        moved = (updated ?? []).map(r => r.id);
      }
      if (moved.length) {
        const historyWrite = await supabaseAdmin.from("lead_assignments").insert(
          moved.map((id) => ({ lead_id: id, from_agent_id: null, to_agent_id: agent.id, source: "leadhub_count" })),
        );
        if (historyWrite.error) throw new Error("Assignment saved but history write failed; IT review required before retry");
      }
      await logAudit({
        action: "lead_assigned",
        entityType: "lead",
        entityId: null,
        actorProfileId: null,
        actorLabel: caller.label,
        metadata: {
          requestId: data.requestId,
          previewGeneratedAt: preview.generatedAt,
          reviewedLeadIds: ids,
          agentId: agent.id,
          requested: row.count,
          count: moved.length,
          source: "leadhub_count",
          leadIds: moved,
        },
      });
      results.push({ agentId: agent.id, requested: row.count, assigned: moved.length });
    }
    return { replay: false, results, available: await pool.usablePoolCount() };
  });
