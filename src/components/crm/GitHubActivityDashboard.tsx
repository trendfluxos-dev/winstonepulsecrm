import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleDot, GitCommitHorizontal, GitPullRequest, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { getGithubActivity } from "@/lib/github-status.functions";
import { useT } from "@/lib/i18n";

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) : "—";
}

/** Read-only GitHub activity summary for IT (full IT PIN). Makes no repository changes. */
export function GitHubActivityDashboard() {
  const t = useT();
  const adminToken = useAdminToken();
  const [repository, setRepository] = useState("trendfluxos-dev/winstone-pulse-crm");
  const load = useServerFn(getGithubActivity);
  const run = useMutation({ mutationFn: () => load({ data: { adminToken: getAdminToken(), repository: repository.trim() } }) });
  const data = run.data;
  const valid = REPO_RE.test(repository.trim());

  return (
    <section className="card-elevated space-y-4 p-5" aria-label="GitHub activity">
      <div>
        <h2 className="font-semibold">{t({ en: "GitHub activity", bn: "GitHub কার্যক্রম" })}</h2>
        <p className="text-xs text-muted-foreground">{t({ en: "Recent commits, issues and pull requests. Read-only.", bn: "সাম্প্রতিক commit, issue ও pull request। শুধু দেখা যাবে।" })}</p>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (valid) run.mutate(); }}>
        <Input value={repository} maxLength={200} onChange={(e) => { setRepository(e.target.value); run.reset(); }} placeholder="owner/repository" aria-label={t({ en: "Repository", bn: "রিপোজিটরি" })} />
        <Button type="submit" disabled={!adminToken || !valid || run.isPending}>
          <RefreshCw className={run.isPending ? "size-4 animate-spin" : "size-4"} />
          {data ? t({ en: "Refresh", bn: "রিফ্রেশ" }) : t({ en: "Load summary", bn: "সারাংশ দেখুন" })}
        </Button>
      </form>
      {!adminToken && <p className="text-sm text-muted-foreground">{t({ en: "Unlock IT Console with the full IT PIN first.", bn: "আগে পূর্ণ IT PIN দিয়ে IT Console খুলুন।" })}</p>}
      {run.isError && <p className="text-sm text-destructive">{(run.error as Error).message}</p>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label={t({ en: "Recent commits", bn: "সাম্প্রতিক commit" })} value={data.commits.length} />
            <Stat label={t({ en: "Open issues", bn: "খোলা issue" })} value={data.openIssueCount} />
            <Stat label={t({ en: "Open PRs", bn: "খোলা PR" })} value={data.openPullCount} />
          </div>
          <p className="text-[11px] text-muted-foreground">{t({ en: "Checked", bn: "যাচাই" })}: {when(data.checkedAt)} · {t({ en: "counts cover the latest items GitHub returned", bn: "সংখ্যা GitHub-এর সর্বশেষ তালিকা থেকে" })}</p>

          <Block icon={<GitCommitHorizontal className="size-4 text-primary" />} title={t({ en: "Commits", bn: "Commit" })} empty={t({ en: "No commits returned.", bn: "কোনো commit পাওয়া যায়নি।" })}
            items={data.commits.map((c) => ({ key: c.sha, url: c.url, title: c.message, meta: `${c.sha} · ${c.author} · ${when(c.date)}` }))} />
          <Block icon={<CircleDot className="size-4 text-primary" />} title={t({ en: "Issues", bn: "Issue" })} empty={t({ en: "No issues.", bn: "কোনো issue নেই।" })}
            items={data.issues.map((i) => ({ key: String(i.number), url: i.url, title: `#${i.number} ${i.title}`, badge: i.state, meta: `${i.author} · ${i.comments} 💬 · ${when(i.updatedAt)}` }))} />
          <Block icon={<GitPullRequest className="size-4 text-primary" />} title={t({ en: "Pull requests", bn: "Pull request" })} empty={t({ en: "No pull requests.", bn: "কোনো pull request নেই।" })}
            items={data.pulls.map((p) => ({ key: String(p.number), url: p.url, title: `#${p.number} ${p.title}`, badge: p.state, meta: `${p.author} · ${when(p.updatedAt)}` }))} />
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Block({ icon, title, empty, items }: { icon: React.ReactNode; title: string; empty: string; items: { key: string; url: string; title: string; meta: string; badge?: string }[] }) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</h3>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ul className="divide-y divide-border text-sm">
          {items.map((it) => (
            <li key={it.key} className="py-2">
              <div className="flex items-start justify-between gap-2">
                <a href={it.url} target="_blank" rel="noreferrer" className="min-w-0 break-words underline-offset-2 hover:underline">{it.title}</a>
                {it.badge ? <Badge variant="outline" className="shrink-0">{it.badge}</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground">{it.meta}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
