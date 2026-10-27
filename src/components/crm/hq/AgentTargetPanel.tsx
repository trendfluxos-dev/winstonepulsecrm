import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAgentTargets, setAgentTarget } from "@/lib/agent-targets.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

/** HQ: per-agent daily lead target (1–50). Used by the next daily hand-out; 50 stays the hard cap. */
export function AgentTargetPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const list = useServerFn(listAgentTargets);
  const save = useServerFn(setAgentTarget);
  const q = useQuery({ queryKey: ["hq-agent-targets", adminToken], queryFn: () => list({ data: { adminToken } }) });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: (v: { agentId: string; target: number }) => save({ data: { adminToken, ...v } }),
    onSuccess: () => { toast.success(t({ bn: "টার্গেট সংরক্ষিত", en: "Target saved" })); qc.invalidateQueries({ queryKey: ["hq-agent-targets"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  if (q.isError) return null;
  const data = q.data;
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-base font-semibold">{t({ bn: "এজেন্টপ্রতি দৈনিক লিড টার্গেট", en: "Daily lead target per agent" })}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t({ bn: `১–${data?.max ?? 50} এর মধ্যে। খালি থাকলে সাধারণ রাউন্ড (${data?.floorQuota ?? "—"})। পরের দৈনিক বণ্টন থেকে কার্যকর।`, en: `1–${data?.max ?? 50}. Blank uses the floor round (${data?.floorQuota ?? "—"}). Applies from the next daily hand-out.` })}
      </p>
      <ul className="mt-3 divide-y">
        {(data?.rows ?? []).map((r) => {
          const value = draft[r.id] ?? String(r.target ?? "");
          const n = Number(value);
          const valid = Number.isInteger(n) && n >= 1 && n <= (data?.max ?? 50);
          return (
            <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{t({ bn: "এখন", en: "Now" })}: {r.target ?? data?.floorQuota}{r.target == null ? t({ bn: " (সাধারণ)", en: " (floor)" }) : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Input aria-label={`${r.name} target`} type="number" inputMode="numeric" min={1} max={data?.max ?? 50} className="h-9 w-20" value={value} placeholder={String(data?.floorQuota ?? "")} onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))} />
                <Button size="sm" disabled={!valid || n === r.target || m.isPending} onClick={() => m.mutate({ agentId: r.id, target: n })}>{t({ bn: "সেভ", en: "Save" })}</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
