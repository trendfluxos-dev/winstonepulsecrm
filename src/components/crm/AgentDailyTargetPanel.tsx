import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAgentDailyTargets, saveAgentDailyTarget } from "@/lib/agent-daily-target.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

export function AgentDailyTargetPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const read = useServerFn(listAgentDailyTargets);
  const save = useServerFn(saveAgentDailyTarget);
  const cache = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ["agent-daily-targets", adminToken], queryFn: () => read({ data: { adminToken } }), retry: false });
  const mutation = useMutation({ mutationFn: (agentId: string) => save({ data: { adminToken, agentId, target: Number(drafts[agentId]) } }), onSuccess: async () => {
    setDrafts({}); await Promise.all([cache.invalidateQueries({ queryKey: ["agent-daily-targets"] }), cache.invalidateQueries({ queryKey: ["daily-new-allocation"] })]);
  } });
  return <section aria-label={t({ bn: "এজেন্টের দৈনিক লক্ষ্য সম্পাদনা", en: "Edit agent daily targets" })} className="space-y-3 border-y border-border py-4">
    <h2 className="text-sm font-semibold">{t({ bn: "এজেন্টের দৈনিক লক্ষ্য", en: "Agent daily targets" })}</h2>
    <p className="text-xs text-muted-foreground">{t({ bn: "লক্ষ্য ১–৫০; আজ থেকে সারাংশে কার্যকর। বণ্টনের কঠোর সর্বোচ্চ সীমা ৫০ এবং LeadHub-এর নিয়ম অপরিবর্তিত।", en: "Targets 1–50 apply to summaries from today. The hard allocation cap of 50 and LeadHub routing remain unchanged." })}</p>
    {query.isPending && <p className="text-sm text-muted-foreground">{t({ bn: "তথ্য আনা হচ্ছে…", en: "Loading…" })}</p>}
    {query.isError && <p role="alert" className="text-sm text-destructive">{t({ bn: "পূর্ণ IT অনুমতি দিয়ে লক্ষ্য আবার যাচাই করুন।", en: "Verify targets with full IT access." })}</p>}
    {mutation.isError && <p role="alert" className="text-sm text-destructive">{t({ bn: "লক্ষ্য সংরক্ষণ হয়নি। ১–৫০-এর পূর্ণ সংখ্যা ও IT অনুমতি যাচাই করুন।", en: "Target not saved. Check a whole number from 1–50 and IT access." })}</p>}
    {mutation.isSuccess && <p role="status" className="text-sm text-success">{t({ bn: "লক্ষ্য সংরক্ষিত হয়েছে।", en: "Target saved." })}</p>}
    <ul className="divide-y divide-border">{query.data?.agents.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><label htmlFor={`target-${a.id}`} className="min-w-0 flex-1 break-words text-sm font-medium">{a.name}</label><div className="flex items-center gap-2"><Input id={`target-${a.id}`} aria-label={`${a.name} ${t({ bn: "দৈনিক লক্ষ্য", en: "daily target" })}`} className="w-20" type="number" min={1} max={50} step={1} value={drafts[a.id] ?? a.target} onChange={e => setDrafts(d => ({ ...d, [a.id]: e.target.value }))} /><Button size="icon" variant="outline" title={t({ bn: "লক্ষ্য সংরক্ষণ", en: "Save target" })} aria-label={`${t({ bn: "লক্ষ্য সংরক্ষণ", en: "Save target" })} ${a.name}`} disabled={mutation.isPending || drafts[a.id] === undefined || !Number.isInteger(Number(drafts[a.id])) || Number(drafts[a.id]) < 1 || Number(drafts[a.id]) > 50} onClick={() => mutation.mutate(a.id)}><Save /></Button></div></li>)}</ul>
  </section>;
}