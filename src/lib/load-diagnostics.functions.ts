import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { LoadEvent, OccurrenceRow } from "@/lib/load-diagnostics";

/** Most events one view returns; above this the response says it was capped. */
export const LOAD_DIAGNOSTICS_CAP = 5000;
const MAX_SPAN_MS = 90 * 86_400_000;

const Input = z
  .object({
    adminToken: z.string().nullable().optional(),
    fromIso: z.string().datetime(),
    toIso: z.string().datetime(),
    route: z.string().max(300).optional(),
    kind: z.string().max(60).optional(),
  })
  .refine((v) => Date.parse(v.toIso) > Date.parse(v.fromIso), { message: "End must be after start" })
  .refine((v) => Date.parse(v.toIso) - Date.parse(v.fromIso) <= MAX_SPAN_MS, { message: "Range is limited to 90 days" });

/**
 * HQ/IT (authority) read-only view of page-load telemetry already stored in
 * runtime_error_occurrences. No writes. Raw user agents never leave the
 * server; every row passes through the redacting toLoadEvent mapper.
 */
export const listLoadDiagnostics = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("@/lib/page-all");
    const { toLoadEvent } = await import("@/lib/load-diagnostics");

    const res = await pageAllParallel<OccurrenceRow>((from, to) => {
      if (from >= LOAD_DIAGNOSTICS_CAP) return Promise.resolve({ data: [], error: null });
      let q = supabaseAdmin
        .from("runtime_error_occurrences")
        .select("id, occurred_at, route, detail, browser, recovery_outcome, issue:runtime_error_issues!inner(kind, source, message)")
        .gte("occurred_at", data.fromIso)
        .lt("occurred_at", data.toIso);
      if (data.route) q = q.eq("route", data.route);
      if (data.kind) q = q.eq("issue.kind", data.kind);
      return q
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, Math.min(to, LOAD_DIAGNOSTICS_CAP - 1)) as unknown as PromiseLike<{ data: OccurrenceRow[] | null; error: { message: string } | null }>;
    }, { concurrency: 5 });
    if (res.error) throw new Error("Could not read diagnostics");

    const rows = res.data ?? [];
    const events: LoadEvent[] = rows.map(toLoadEvent);
    return {
      events,
      capped: rows.length >= LOAD_DIAGNOSTICS_CAP,
      fromIso: data.fromIso,
      toIso: data.toIso,
      readAtUtc: new Date().toISOString(),
    };
  });
