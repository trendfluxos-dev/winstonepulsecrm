import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenInput = z.object({ adminToken: z.string().max(256).nullable() }).strict();

async function requireFullIt(token: string | null) {
  const { adminTokenScope } = await import("@/lib/admin-gate.server");
  if (adminTokenScope(token) !== "full") throw new Error("Full IT PIN required");
}

/** Read the latest 60 saved database performance snapshots (full IT PIN). */
export const getDbPerformanceSnapshots = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ data }) => {
    await requireFullIt(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("db_performance_snapshots")
      .select("id, captured_at, db_size_bytes, total_calls, total_exec_ms, top_queries")
      .order("captured_at", { ascending: false }).limit(60);
    if (error) throw new Error("Could not read snapshots");
    return (rows ?? []).map((r) => ({ ...r, top_queries: (r.top_queries ?? []) as { query: string; calls: number; mean_ms: number; total_ms: number }[] }));
  });

/** Save one snapshot of current database size and query statistics (full IT PIN). */
export const captureDbPerformanceSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ data }) => {
    await requireFullIt(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("capture_db_performance_snapshot");
    if (error) throw new Error("Could not save snapshot");
    return { ok: true };
  });
