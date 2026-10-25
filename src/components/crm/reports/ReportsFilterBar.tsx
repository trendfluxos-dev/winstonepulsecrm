import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUSES, type LeadStatus, type Profile } from "@/lib/crm-data";
import { defaultFilters, type ReportFilters } from "@/lib/crm-reports";
import { useT } from "@/lib/i18n";
import { RotateCcw, Search, X } from "lucide-react";

const PRESETS = [
  { label: { bn: "আজ", en: "Today" }, days: 1 },
  { label: { bn: "শেষ ৭ দিন", en: "Last 7 days" }, days: 7 },
  { label: { bn: "শেষ ৩০ দিন", en: "Last 30 days" }, days: 30 },
  { label: { bn: "শেষ ৯০ দিন", en: "Last 90 days" }, days: 90 },
] as const;

const SENTIMENTS = [
  { key: "positive", label: { bn: "ভালো কথা", en: "Positive" } },
  { key: "neutral", label: { bn: "সাধারণ কথা", en: "Neutral" } },
  { key: "negative", label: { bn: "খারাপ কথা", en: "Negative" } },
  { key: "critical", label: { bn: "জরুরি সমস্যা", en: "Critical" } },
] as const;

/** Date range, search, agent, source, stage and sentiment filters — inline on desktop, collapsible on mobile. */
export function ReportsFilterBar({
  filters,
  patch,
  setFilters,
  agents,
  sources,
  visible,
  matchedAgents,
  matchedLeads,
  matchedCalls,
}: {
  filters: ReportFilters;
  patch: (next: Partial<ReportFilters>) => void;
  setFilters: (next: ReportFilters) => void;
  agents: Profile[];
  sources: string[];
  visible: boolean;
  matchedAgents: number;
  matchedLeads: number;
  matchedCalls: number;
}) {
  const t = useT();
  const active: { key: string; label: string; clear: () => void }[] = [];
  if (filters.query.trim())
    active.push({
      key: "query",
      label: `${t({ bn: "খোঁজ", en: "Search" })}: ${filters.query.trim()}`,
      clear: () => patch({ query: "" }),
    });
  if (filters.agentId !== "all") {
    const agent = agents.find((a) => a.id === filters.agentId);
    active.push({
      key: "agent",
      label: `${t({ bn: "এজেন্ট", en: "Agent" })}: ${agent?.name ?? filters.agentId}`,
      clear: () => patch({ agentId: "all" }),
    });
  }
  if (filters.source !== "all")
    active.push({
      key: "source",
      label: `${t({ bn: "কোথা থেকে", en: "Source" })}: ${filters.source}`,
      clear: () => patch({ source: "all" }),
    });
  if (filters.status !== "all") {
    const st = LEAD_STATUSES.find((s) => s.key === filters.status);
    active.push({
      key: "status",
      label: `${t({ bn: "অবস্থা", en: "Status" })}: ${st?.label ?? filters.status}`,
      clear: () => patch({ status: "all" }),
    });
  }
  if (filters.sentiment !== "all") {
    const se = SENTIMENTS.find((s) => s.key === filters.sentiment);
    active.push({
      key: "sentiment",
      label: `${t({ bn: "কথার ধরন", en: "Mood" })}: ${se ? t(se.label) : filters.sentiment}`,
      clear: () => patch({ sentiment: "all" }),
    });
  }

  return (
    <section
      className={`card-elevated flex-col gap-3 p-3 sm:p-4 ${visible ? "flex" : "hidden lg:flex"}`}
    >
      <p className="text-xs text-muted-foreground">
        {t({
          bn: "যেমন চান তেমন বাছুন — নিচের সব হিসাব সঙ্গে সঙ্গে বদলে যাবে।",
          en: "Pick what you want — the numbers below update right away.",
        })}
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.query}
          onChange={(e) => patch({ query: e.target.value })}
          placeholder={t({ bn: "নাম, মোবাইল বা রেফারেন্স লিখে খুঁজুন…", en: "Type a name, phone or reference…" })}
          className="h-10 pl-9"
          aria-label={t({ bn: "লিড খুঁজুন", en: "Search leads" })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:flex xl:flex-wrap xl:items-end">
        <Field label={t({ bn: "শুরুর তারিখ", en: "From date" })}>
          <Input
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(e) => patch({ from: e.target.value })}
            className="h-9 w-full xl:w-[150px]"
          />
        </Field>
        <Field label={t({ bn: "শেষ তারিখ", en: "To date" })}>
          <Input
            type="date"
            value={filters.to}
            min={filters.from}
            onChange={(e) => patch({ to: e.target.value })}
            className="h-9 w-full xl:w-[150px]"
          />
        </Field>
        <Field label={t({ bn: "কোন এজেন্ট", en: "Which agent" })}>
          <Select value={filters.agentId} onValueChange={(v) => patch({ agentId: v })}>
            <SelectTrigger className="h-9 w-full xl:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t({ bn: "সব এজেন্ট", en: "All agents" })}</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t({ bn: "লিড এসেছে কোথা থেকে", en: "Lead source" })}>
          <Select value={filters.source} onValueChange={(v) => patch({ source: v })}>
            <SelectTrigger className="h-9 w-full xl:w-[165px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t({ bn: "সব জায়গা থেকে", en: "All sources" })}</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t({ bn: "লিডের অবস্থা", en: "Lead status" })}>
          <Select
            value={filters.status}
            onValueChange={(v) => patch({ status: v as LeadStatus | "all" })}
          >
            <SelectTrigger className="h-9 w-full xl:w-[155px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t({ bn: "সব অবস্থা", en: "All statuses" })}</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t({ bn: "কথার ধরন", en: "Call mood" })}>
          <Select value={filters.sentiment} onValueChange={(v) => patch({ sentiment: v })}>
            <SelectTrigger className="h-9 w-full xl:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t({ bn: "সব ধরনের", en: "All moods" })}</SelectItem>
              {SENTIMENTS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {t(s.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-3 xl:col-span-1">
          {PRESETS.map((p) => (
            <Button
              key={p.days}
              variant="secondary"
              size="sm"
              onClick={() => patch(defaultFilters(p.days))}
            >
              {t(p.label)}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setFilters(defaultFilters(30))}>
            <RotateCcw className="size-4" /> {t({ bn: "আগের অবস্থায় ফিরুন", en: "Reset" })}
          </Button>
        </div>
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label={t({ bn: "যেগুলো বেছে নেওয়া হয়েছে", en: "Active filters" })}>
          {active.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
      <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed" aria-live="polite">
        {matchedAgents > 0 || matchedLeads > 0 || matchedCalls > 0 ? (
          <p>
            <span className="font-semibold text-foreground">
              {t({
                bn: `${filters.from} থেকে ${filters.to} — এই শর্তে মিলেছে:`,
                en: `From ${filters.from} to ${filters.to} — matches:`,
              })}
            </span>{" "}
              bn: `${matchedAgents} জন এজেন্ট, ${matchedLeads}টি লিড, ${matchedCalls}টি কল। চিপে চাপ দিলে সেই শর্ত সরে যাবে।`,
              en: `${matchedAgents} agent${matchedAgents === 1 ? "" : "s"}, ${matchedLeads} lead${matchedLeads === 1 ? "" : "s"}, ${matchedCalls} call${matchedCalls === 1 ? "" : "s"}. Tap a chip to remove that filter.`,
              en: `${matchedAgents} agent${matchedAgents === 1 ? "" : "s"}, ${matchedLeads} lead${matchedLeads === 1 ? "" : "s"}, ${matchedCalls} call${matchedCalls === 1 ? "" : "s"}. Tap a chip above to remove that filter.`,
            })}
          </p>
        ) : (
          <p>
            <span className="font-semibold text-foreground">
              {t({ bn: "এই শর্তে কিছু পাওয়া যায়নি।", en: "Nothing matches these filters." })}
            </span>{" "}
            {t({
              bn: "তারিখ বাড়ান — 'শেষ ৯০ দিন' চাপুন। তারপরও কিছু না মিললে — 'আগের অবস্থায় ফিরুন' চাপুন।",
              en: "Widen the dates — tap 'Last 90 days'. Still nothing? Press 'Reset' to clear everything.",
            })}
          </p>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
