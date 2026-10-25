import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Flame,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";

import { CONNECTED_THRESHOLD_SECONDS, useSnapshot } from "@/lib/crm-data";
import { leadOwner } from "@/lib/lead-owner";
import { useT } from "@/lib/i18n";

type Bilingual = { bn: string; en: string };

type Insight = {
  tone: "good" | "watch" | "urgent";
  icon: React.ReactNode;
  title: Bilingual;
  detail: Bilingual;
};

const TONE: Record<Insight["tone"], string> = {
  good: "border-primary/30 bg-primary/[0.07] text-primary",
  watch: "border-border bg-muted/40 text-foreground",
  urgent: "border-destructive/40 bg-destructive/[0.08] text-destructive",
};

function sameDay(iso: string, ref: Date) {
  return new Date(iso).toDateString() === ref.toDateString();
}

/**
 * Reads the same live snapshot the boards already use and turns it into a few
 * short, plain sentences: what changed since yesterday, what is overdue, and
 * what to do next. Every number comes from real rows — nothing is invented.
 */
export function SmartInsightStrip({ scope }: { scope: "desk" | "floor" }) {
  const t = useT();
  const { leads, calls, isPending } = useSnapshot();

  const insights = useMemo<Insight[]>(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000);

    const todayCalls = calls.filter((c) => sameDay(c.created_at, now));
    const yesterdayCalls = calls.filter((c) => sameDay(c.created_at, yesterday));
    const conn = (rows: typeof calls) =>
      rows.filter((c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS).length;
    const todayConnected = conn(todayCalls);
    const yesterdayConnected = conn(yesterdayCalls);
    const delta = todayConnected - yesterdayConnected;

    const followUpsDue = leads.filter(
      (l) => l.status === "follow_up" && (!l.last_call_at || new Date(l.last_call_at) < yesterday),
    ).length;
    const unfinished = leads.filter((l) => l.work_state !== "completed" && leadOwner(l)).length;
    const hot = leads.filter((l) => l.temperature === "hot" && l.status !== "closed").length;
    const untouched = leads.filter((l) => (l.call_count ?? 0) === 0 && leadOwner(l)).length;

    const rows: Insight[] = [];

    rows.push(
      delta >= 0
        ? {
            tone: "good",
            icon: <TrendingUp className="size-4" />,
            title: {
              bn: `আজ ${todayConnected} জনের সাথে কথা হয়েছে`,
              en: `${todayConnected} calls answered today`,
            },
            detail:
              delta === 0
                ? { bn: "গতকালের সমান গতি — ধারাবাহিক থাকুন।", en: "Same pace as yesterday — keep it going." }
                : { bn: `গতকালের চেয়ে ${delta}টি বেশি। ভালো চলছে।`, en: `${delta} more than yesterday. Going well.` },
          }
        : {
            tone: "watch",
            icon: <TrendingDown className="size-4" />,
            title: {
              bn: `আজ ${todayConnected} জনের সাথে কথা হয়েছে`,
              en: `${todayConnected} calls answered today`,
            },
            detail: {
              bn: `গতকালের চেয়ে ${Math.abs(delta)}টি কম — আর কয়েকটি কল দিয়ে ফেলুন।`,
              en: `${Math.abs(delta)} less than yesterday — make a few calls now.`,
            },
          },
    );

    if (hot > 0) {
      rows.push({
        tone: "urgent",
        icon: <Flame className="size-4" />,
        title: {
          bn: `${hot}টি গুরুত্বপূর্ণ (হট) লিড বাকি`,
          en: `${hot} hot leads waiting`,
        },
        detail: {
          bn: "সবার আগে এগুলোতে কল দিন — এখানেই ডিল হওয়ার সম্ভাবনা সবচেয়ে বেশি।",
          en: "Call these first — deals are most likely here.",
        },
      });
    }

    if (followUpsDue > 0) {
      rows.push({
        tone: followUpsDue > 5 ? "urgent" : "watch",
        icon: <CalendarClock className="size-4" />,
        title: {
          bn: `${followUpsDue}টি ফলো-আপ সময় পেরিয়ে গেছে`,
          en: `${followUpsDue} follow-ups overdue`,
        },
        detail: {
          bn: "একদিনের বেশি পুরোনো ফলো-আপ ঠান্ডা হয়ে যায় — আজই ফিরিয়ে আনুন।",
          en: "Follow-ups older than a day go cold — catch up today.",
        },
      });
    }

    if (untouched > 0) {
      rows.push({
        tone: "watch",
        icon: <AlertTriangle className="size-4" />,
        title: {
          bn: `${untouched}টি লিডে এখনো একটিও কল হয়নি`,
          en: `${untouched} leads not called yet`,
        },
        detail:
          scope === "floor"
            ? { bn: "ভাগ ঠিক আছে কি না দেখে নিন — কাজ শুরুর আগে।", en: "Check the sharing before work starts." }
            : { bn: "আজকের তালিকার শুরু থেকেই কল শুরু করুন।", en: "Start calling from the top of today's list." },
      });
    }

    if (rows.length < 3 && unfinished === 0) {
      rows.push({
        tone: "good",
        icon: <CheckCircle2 className="size-4" />,
        title: { bn: "সব লিডের কাজ শেষ", en: "All leads are done" },
        detail: { bn: "নতুন তালিকা আসা পর্যন্ত পরিষ্কার — চমৎকার কাজ!", en: "Clear until the next list arrives — great work!" },
      });
    }

    return rows.slice(0, 4);
  }, [calls, leads, scope]);

  if (isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <section aria-label={t({ bn: "স্মার্ট পরামর্শ", en: "Smart tips" })} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {insights.map((row) => (
        <article
          key={row.title.en}
          className={`rounded-xl border p-3 shadow-sm transition-colors ${TONE[row.tone]}`}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="shrink-0">{row.icon}</span>
            <span className="min-w-0">{t(row.title)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t(row.detail)}</p>
        </article>
      ))}
    </section>
  );
}
