import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getAiModel, getAiTeamSummary, setAiModel } from "@/lib/ai-features.functions";
import { useLang, useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

/**
 * HQ panel: picks the AI model for every CRM AI feature, and generates
 * today's team summary. Authority (master PIN) only. OpenAI/Gemini run
 * through the built-in gateway with zero setup; Meta (Muse Spark) stays
 * disabled and marked "setup required" until the server key is configured.
 */
export function AiTeamSummary() {
  const t = useT();
  const lang = useLang();
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const summary = useServerFn(getAiTeamSummary);
  const modelGet = useServerFn(getAiModel);
  const modelSet = useServerFn(setAiModel);

  const model = useQuery({ queryKey: ["ai-model"], queryFn: () => modelGet() });
  const switchModel = useMutation({
    mutationFn: (next: "openai" | "gemini" | "meta") => modelSet({ data: { adminToken: adminToken ?? "", model: next } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-model"] });
      toast.success(t({ bn: "AI মডেল বদলানো হয়েছে", en: "AI model updated" }));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const run = useMutation({
    mutationFn: () => summary({ data: { adminToken, lang } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <section className="card-elevated space-y-4 p-4" aria-label={t({ bn: "AI টিম সারাংশ", en: "AI team summary" })}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {t({ bn: "Winstone AI — দৈনিক টিম সারাংশ", en: "Winstone AI — daily team summary" })}
        </h2>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t({ bn: "মডেল", en: "Model" })}
          <select
            aria-label={t({ bn: "AI মডেল", en: "AI model" })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            value={model.data?.model ?? "openai"}
            disabled={switchModel.isPending}
            onChange={(e) => switchModel.mutate(e.target.value as "openai" | "gemini" | "meta")}
          >
            <option value="openai">OpenAI (GPT-6 Astra)</option>
            <option value="gemini">Gemini (3.8 Flash)</option>
            <option value="meta" disabled={!model.data?.metaConfigured}>
              {model.data?.metaConfigured
                ? "Meta (Muse Spark 1.3)"
                : t({ bn: "Meta (Muse Spark 1.3) — সেটআপ প্রয়োজন", en: "Meta (Muse Spark 1.3) — setup required" })}
            </option>
          </select>
        </label>
      </div>

      {model.data?.model === "meta" && !model.data.metaConfigured && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {t({
            bn: "Meta মডেল নির্বাচিত, কিন্তু সার্ভারে এর কনফিগারেশন নেই — AI কাজ করবে না। OpenAI বা Gemini বেছে নিন।",
            en: "Meta is selected but not configured on the server — AI features will fail. Switch to OpenAI or Gemini.",
          })}
        </p>
      )}

      <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
        {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {t({ bn: "আজকের সারাংশ বানান", en: "Generate today's summary" })}
      </Button>

      {run.data && (
        <div className="space-y-3">
          <p className="whitespace-pre-line rounded-lg border border-border bg-card p-3 text-sm">
            {run.data.summary}
          </p>
          <div className="table-scroll overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">{t({ bn: "এজেন্ট", en: "Agent" })}</th>
                  <th className="py-1 pr-3 font-medium">{t({ bn: "রিপোর্ট", en: "Reports" })}</th>
                  <th className="py-1 pr-3 font-medium">{t({ bn: "কানেক্টেড", en: "Connected" })}</th>
                  <th className="py-1 font-medium">{t({ bn: "টক টাইম (মিনিট)", en: "Talk time (min)" })}</th>
                </tr>
              </thead>
              <tbody>
                {run.data.stats.map((s) => (
                  <tr key={s.agent} className="border-b border-border/60">
                    <td className="py-1.5 pr-3 font-medium">{s.agent}</td>
                    <td className="py-1.5 pr-3">{s.reports}</td>
                    <td className="py-1.5 pr-3">{s.connected}</td>
                    <td className="py-1.5">{s.talkMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
