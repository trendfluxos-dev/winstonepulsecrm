import { createServerFn } from "@tanstack/react-start";

/** Signed-in agent's own submitted reports (today, Dhaka) and current follow-up items. Read-only. */
export const getDeskWork = createServerFn({ method: "POST" }).handler(async () => {
  const { resolveWorkCaller } = await import("@/lib/access.server");
  const caller = await resolveWorkCaller(null);
  if (caller.scope !== "agent" || !caller.profile) throw new Error("Agent access required");
  const me = caller.profile.id;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { dhakaDateOf } = await import("@/lib/business-day");
  const { dhakaDayBounds } = await import("@/lib/accountability");
  const { followUpWork } = await import("@/lib/follow-up-work.server");
  const { pageAllParallel: pageAll } = await import("@/lib/page-all");
  const { start, end } = dhakaDayBounds(dhakaDateOf());
  const [reports, followUps] = await Promise.all([
    supabaseAdmin.from("call_reports").select("id, submitted_at, connected").eq("agent_id", me)
      .not("submitted_at", "is", null).gte("submitted_at", start).lte("submitted_at", end).limit(1000),
    pageAll((a, b) => followUpWork(supabaseAdmin as never, "current").select("id, status, scheduled_at")
      .eq("agent_id", me).in("status", ["upcoming", "rescheduled"]).order("id").range(a, b)),
  ]);
  if (reports.error || followUps.error) throw new Error("Desk work counts unavailable");
  return { agentId: me, reports: reports.data ?? [], followUps: (followUps.data ?? []) as { id: string; status: string; scheduled_at: string | null }[], asOf: new Date().toISOString() };
});

/** Signed-in agent's own submitted call reports (all time, paged, id-deduped). Read-only. */
export const getDeskReports = createServerFn({ method: "POST" }).handler(async () => {
  const { resolveWorkCaller } = await import("@/lib/access.server");
  const caller = await resolveWorkCaller(null);
  if (caller.scope !== "agent" || !caller.profile) throw new Error("Agent access required");
  const me = caller.profile.id;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { pageAllParallel: pageAll } = await import("@/lib/page-all");
  const res = await pageAll((a, b) => supabaseAdmin.from("call_reports").select("id, submitted_at, connected, lead_id, category")
    .eq("agent_id", me).not("submitted_at", "is", null).order("id").range(a, b));
  if (res.error) throw new Error("Report counts unavailable");
  return { agentId: me, reports: (res.data ?? []) as { id: string; submitted_at: string; connected: boolean | null; lead_id: string | null; category: string | null }[] };
});
