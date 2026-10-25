import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listDistributionFailures } from "@/lib/distribution-failure.functions";
import { FAILURE_REASONS } from "@/lib/distribution-failure";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

export function DistributionFailurePanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const read = useServerFn(listDistributionFailures);
  const q = useQuery({ queryKey: ["distribution-failures", adminToken], queryFn: () => read({ data: { adminToken } }), refetchInterval: 60_000, retry: false });
  const stages = { prepare: { bn: "প্রস্তুতি", en: "Preparation" }, rollover: { bn: "আগের কাজ এগিয়ে আনা", en: "Work rollover" }, plan: { bn: "দৈনিক পরিকল্পনা", en: "Daily plan" }, pool: { bn: "লিড পুল যাচাই", en: "Pool check" }, assign: { bn: "লিড বণ্টন", en: "Assignment" }, save_plan: { bn: "বণ্টনের ফল সংরক্ষণ", en: "Saving run result" } };
  return <section className="min-w-0 space-y-3 border-y border-border py-4" aria-label={t({ bn: "অটো বণ্টনের ব্যর্থতা", en: "Auto distribution failures" })}>
    <header className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{t({ bn: "অটো বণ্টনের ব্যর্থতা", en: "Auto distribution failures" })}</h2><Button variant="ghost" size="icon" disabled={q.isFetching} onClick={() => void q.refetch()} aria-label={t({ bn: "ব্যর্থতার তথ্য আবার দেখুন", en: "Refresh failure history" })}><RefreshCw className="size-4" /></Button></header>
    {q.isPending ? <p className="text-xs text-muted-foreground">{t({ bn: "তথ্য আনা হচ্ছে…", en: "Loading…" })}</p> : q.isError ? <p role="alert" className="text-sm text-destructive">{t({ bn: "ব্যর্থতার তথ্য যাচাই করা যায়নি। আবার দেখুন।", en: "Failure history could not be verified. Refresh to retry." })}</p> : !q.data?.length ? <p className="text-sm text-muted-foreground">{t({ bn: "সংরক্ষিত অটো বণ্টন ব্যর্থতার রেকর্ড নেই।", en: "No recorded automatic distribution failures." })}</p> : <ul className="space-y-2">{q.data.map((failure, index) => <li key={failure.id} role={index === 0 ? "alert" : undefined} className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /><div className="min-w-0"><p className="font-semibold">{t({ bn: "স্বয়ংক্রিয় লিড বণ্টন ব্যর্থ", en: "Automatic lead distribution failed" })}</p><p>{t(FAILURE_REASONS[failure.reason])}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date(failure.createdAt))} · {t({ bn: "ঢাকা", en: "Dhaka" })} · {t(stages[failure.stage])}</p><p className="mt-1 text-xs">{t({ bn: "IT যাচাই প্রয়োজন। কিছু লিড ইতিমধ্যে বণ্টিত হতে পারে—LeadHub-এর আজকের হিসাব দেখে সিদ্ধান্ত নিন।", en: "IT review needed. Some leads may already be assigned—check today's LeadHub totals before deciding." })}</p></div></li>)}</ul>}
  </section>;
}