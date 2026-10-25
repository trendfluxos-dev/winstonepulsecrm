import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getAiModel, getAiTeamSummary, setAiModel } from "@/lib/ai-features.functions";
import { aiFailureLabel } from "@/lib/ai-providers";

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
    mutationFn: (next: "openai" | "gemini" | "meta" | "vertex") => modelSet({ data: { adminToken: adminToken ?? "", model: next } }),
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

  const dhaka = (iso: string) =>
    new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
      timeZone: "Asia/Dhaka",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));

  /** Safe failure text: HTTP status plus a short reason. Never provider detail. */
  const failureText = (status: number) => {
    const label = t(aiFailureLabel(status));
    return status > 0 ? `${status} · ${label}` : label;
  };

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
            onChange={(e) => switchModel.mutate(e.target.value as "openai" | "gemini" | "meta" | "vertex")}
          >
            <option value="openai">OpenAI (GPT-6 Astra)</option>
            <option value="gemini">Gemini (3.8 Flash)</option>
            <option value="meta" disabled={!model.data?.metaConfigured}>
              {model.data?.metaConfigured
                ? "Meta (Muse Spark 1.3)"
                : t({ bn: "Meta (Muse Spark 1.3) — সেটআপ প্রয়োজন", en: "Meta (Muse Spark 1.3) — setup required" })}
            </option>
            <option value="vertex" disabled={!model.data?.vertexConfigured}>
              {model.data?.vertexConfigured
                ? "Google Vertex AI (Gemini 2.5 Flash)"
                : t({ bn: "Google Vertex AI — সেটআপ প্রয়োজন", en: "Google Vertex AI — setup required" })}
            </option>
          </select>
        </label>
      </div>

      {model.data && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green-600" aria-hidden />
            {t({ bn: "সক্রিয় মডেল:", en: "Active model:" })}{" "}
            <span className="font-medium text-foreground">
              {model.data.model === "meta"
                ? "Meta (Muse Spark 1.3)"
                : model.data.model === "vertex"
                  ? "Google Vertex AI (Gemini 2.5 Flash)"
                  : model.data.model === "gemini"
                    ? "Gemini (3.8 Flash)"
                    : "OpenAI (GPT-6 Astra)"}
            </span>
          </span>
          <span aria-hidden>·</span>
          <span>
            {model.data.lastSuccessAt
              ? t({ bn: "শেষ সফল কল:", en: "Last successful call:" }) +
                " " +
                new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
                  timeZone: "Asia/Dhaka",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(model.data.lastSuccessAt))
              : t({ bn: "এখনও কোনো সফল AI কল নেই", en: "No successful AI call yet" })}
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${model.data.lastErrorAt ? "bg-destructive" : "bg-muted-foreground/40"}`}
              aria-hidden
            />
            {model.data.lastErrorAt ? (
              <>

                {t({ bn: "শেষ ব্যর্থ কল:", en: "Last failed call:" })}{" "}
                <span className="font-medium text-foreground">
                  {dhaka(model.data.lastErrorAt)}
                  {model.data.lastErrorStatus !== null &&
                    ` · ${failureText(model.data.lastErrorStatus)}`}
                </span>
              </>
            ) : (
              t({ bn: "এখনও কোনো বর্যর্থ AI কল নেই", en: "No failed AI call yet" })
            )}
          </span>
        </p>
      )}

      {model.data && model.data.history.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">
            {t({ bn: "সাম্প্রতিক AI কলের ইতিহাস", en: "Recent AI call history" })}
          </p>
          <ul className="mt-2 space-y-1.5">
            {model.data.history.map((entry, i) => (
              <li
                key={`${entry.at}-${i}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${entry.ok ? "bg-green-600" : "bg-destructive"}`}
                  aria-hidden
                />
                <span className="font-medium text-foreground">{dhaka(entry.at)}</span>
                <span aria-hidden>·</span>
                {entry.ok ? (
                  <span>{t({ bn: "সফল", en: "Successful" })}</span>
                ) : (
                  <span>
                    {t({ bn: "ব্যর্থ", en: "Failed" })}
                    {typeof entry.status === "number" && ` · ${failureText(entry.status)}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {model.data?.model === "meta" &&
        model.data.metaConfigured &&
        (model.data.lastErrorStatus === 402 ||
          model.data.lastErrorStatus === 403 ||
          !model.data.lastSuccessAt) && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">
            <p className="font-medium">
              {t({ bn: "Meta বিলিং সতর্কতা", en: "Meta billing notice" })}
            </p>
            <p className="mt-1 text-muted-foreground">
              {model.data.lastErrorStatus === 402 || model.data.lastErrorStatus === 403
                ? t({
                    bn: "সর্বশেষ কলে Meta বিলিং/ক্রেডিট না থাকায় উত্তর দেয়নি (402)। Meta developer অ্যাকাউন্টে বিলিং বা ক্রেডিট যোগ করুন, তারপর আবার চেষ্টা করুন।",
                    en: "The last call was refused for missing Meta billing/credits (402). Add billing or credits in your Meta developer account, then retry.",
                  })
                : t({
                    bn: "Meta এখনও একটি সফল কল সম্পন্ন করেনি। উত্তর না আসলে Meta developer অ্যাকাউন্টে বিলিং/ক্রেডিট সক্রিয় আছে কিনা দেখুন।",
                    en: "Meta has not completed a successful call yet. If calls fail, check that billing/credits are active in your Meta developer account.",
                  })}
            </p>
          </div>
        )}

      {model.data?.model === "meta" && !model.data.metaConfigured && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {t({
            bn: "Meta মডেল নির্বাচিত, কিন্তু সার্ভারে এর কনফিগারেশন নেই — AI কাজ করবে না। OpenAI বা Gemini বেছে নিন।",
            en: "Meta is selected but not configured on the server — AI features will fail. Switch to OpenAI or Gemini.",
          })}
        </p>
      )}

      {model.data?.model === "vertex" && !model.data.vertexConfigured && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {t({
            bn: "Google Vertex AI নির্বাচিত, কিন্তু সার্ভারে service-account কনফিগারেশন নেই — AI কাজ করবে না। OpenAI বা Gemini বেছে নিন।",
            en: "Google Vertex AI is selected but no service account is configured on the server — AI features will fail. Switch to OpenAI or Gemini.",
          })}
        </p>
      )}

      <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
        {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {t({ bn: "আজকের সারাংশ বানান", en: "Generate today's summary" })}
      </Button>

      {run.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
        >
          <p className="text-xs text-destructive">
            {run.error instanceof Error
              ? run.error.message
              : t({ bn: "সারাংশ বানানো যায়নি", en: "The summary could not be generated" })}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={run.isPending}
            onClick={() => run.mutate()}
            aria-label={t({ bn: "সারাংশ আবার চালান", en: "Run the summary again" })}
          >
            {run.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            {t({ bn: "আবার চেষ্টা করুন", en: "Try again" })}
          </Button>
        </div>
      )}

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
