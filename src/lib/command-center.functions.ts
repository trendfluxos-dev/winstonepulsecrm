import { followUpWork } from "@/lib/follow-up-work.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Read-only feed for the Sales Command Center: submitted call reports and
 * follow-up events, fully paged (no latest-N truncation) and scoped by the
 * server-resolved caller — agents get only their own rows, HQ the floor.
 */
const Input = z.object({
  adminToken: z.string().nullable().optional(),
  /** Floor scope only: return just reports updated at/after this time. */
  reportsSince: z.string().datetime().nullable().optional(),
});

async function pageAll<T>(fetchPage: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { pageAllParallel } = await import("@/lib/page-all");
  // These feeds are a few thousand rows: 3 pages at a time avoids firing
  // empty extra page requests that compete with the board snapshot.
  const { data, error } = await pageAllParallel(fetchPage, { concurrency: 3 });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const REPORT_COLUMNS = "id, lead_id, agent_id, category, customer_response, next_action, requirement, submitted_at, created_at, connected, recording_id, status, connection_verified";

export const getCommandCenterFeed = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("Sign in required");
    const me = caller.scope === "agent" ? caller.profile?.id : null;
    if (caller.scope === "agent" && !me) throw new Error("Agent profile পাওয়া যায়নি");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const freshness = { generatedAt: new Date().toISOString(), timezone: "Asia/Dhaka", reportsPaged: true, followUpsPaged: true };
    const since = me ? null : data.reportsSince ?? null;

    const [reports, followUps, total] = await Promise.all([
      pageAll((a, b) => {
        let q = supabaseAdmin.from("call_reports").select(REPORT_COLUMNS).eq("status", "submitted");
        if (me) q = q.eq("agent_id", me);
        if (since) q = q.gte("updated_at", since);
        return q.order("created_at", { ascending: true }).order("id").range(a, b);
      }),
      pageAll((a, b) => {
        let q = followUpWork(supabaseAdmin, "current")
          .select("id, lead_id, agent_id, status, scheduled_at, completed_at");
        if (me) q = q.eq("agent_id", me);
        return q.order("created_at", { ascending: true }).order("id").range(a, b);
      }),
      since
        ? supabaseAdmin.from("call_reports").select("id", { count: "exact", head: true }).eq("status", "submitted")
        : Promise.resolve({ count: null, error: null }),
    ]);
    if (total.error) throw new Error(total.error.message);
    if (me) {
      const { assignedLeadIds, filterAssignedActivity } = await import('@/lib/assigned-lead-scope.server');
      const ids = await assignedLeadIds(me);
      return { reports: filterAssignedActivity(reports, ids), followUps: filterAssignedActivity(followUps, ids), freshness, reportsMode: "full" as "full" | "delta", reportCount: null as number | null };
    }
    return { reports, followUps, freshness, reportsMode: (since ? "delta" : "full") as "full" | "delta", reportCount: (since ? total.count : reports.length) as number | null };
  });
