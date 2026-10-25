import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, RefreshCw, Sheet } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { leadReportSheetStatus, pushLeadReportSheet } from "@/lib/lead-report-sheet.functions";
import { useAdminToken } from "@/lib/local-session";
import { nextLeadReportRun } from "@/lib/lead-report-next";

function dhakaTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" });
}

/**
 * IT Console: mirrors the CRM's assigned leads into the workspace "WINSTONE
 * PULSE — Daily Lead Report" Google Sheet, one tab per Dhaka date. The CRM
 * stays the system of record; the sheet is a read mirror for management.
 */
export function LeadReportSheetPanel() {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const status = useServerFn(leadReportSheetStatus);
  const push = useServerFn(pushLeadReportSheet);

  const state = useQuery({
    queryKey: ["lead-report-sheet", adminToken ? "pin" : "session"],
    queryFn: () => status({ data: { adminToken } }),
    refetchInterval: 60_000,
  });

  const sync = useMutation({
    mutationFn: () => push({ data: { adminToken } }),
    onSuccess: (result) => {
      toast.success(`${result.rows}টি লিড "${result.tab}" ট্যাবে জমা হলো`);
      void queryClient.invalidateQueries({ queryKey: ["lead-report-sheet"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const last = state.data?.sync;

  return (
    <section className="card-elevated space-y-3 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
            <Sheet className="size-4 text-primary" /> দৈনিক লিড রিপোর্ট শিট
          </h2>
          <p className="text-xs text-muted-foreground">
            বরাদ্দকৃত লিডের স্ন্যাপশট প্রতিদিনের ঢাকা-তারিখের ট্যাবে Google Sheet-এ যায়। সর্বশেষ
            জমা: {dhakaTime(last?.lastSyncedAt)}
            {last?.tab ? ` · ট্যাব ${last.tab} · ${last.rowCount ?? 0}টি লিড` : ""}
          </p>
          <p className="text-xs font-medium">
            পরবর্তী স্বয়ংক্রিয় সিঙ্ক: {dhakaTime(nextLeadReportRun(new Date()).toISOString())} (প্রতিদিন বিকেল ৫:৩০, ঢাকা; ~৩০ সেকেন্ড দেরি হতে পারে)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {last?.rowCount != null ? <Badge variant="secondary">{last.rowCount}টি লিড</Badge> : null}
          <Button size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            এখনই সিঙ্ক করুন
          </Button>
          {state.data?.sheetUrl ? (
            <Button size="sm" variant="ghost" asChild>
              <a href={state.data.sheetUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> শিট খুলুন
              </a>
            </Button>
          ) : null}
        </div>
      </header>
    </section>
  );
}
