import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GitBranch, Github, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { getGithubRepositoryStatus, getGithubCheckHistory } from "@/lib/github-status.functions";
import { githubCheckInput } from "@/lib/github-status-shared";
import { useT } from "@/lib/i18n";
import { githubRecovery } from "@/lib/github-recovery";

export function GitRepositoryStatusPanel() {
  const t = useT();
  const [repository, setRepository] = useState("trendfluxos-dev/winstone-pulse-crm");
  const [branch, setBranch] = useState("");
  const [retryUsed, setRetryUsed] = useState(false);
  const load = useServerFn(getGithubRepositoryStatus);
  const historyLoad = useServerFn(getGithubCheckHistory);
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const history = useQuery({ queryKey: ["github-check-history", repository.trim(), adminToken],
    queryFn: () => historyLoad({ data: { adminToken, repository: repository.trim() } }),
    enabled: Boolean(adminToken) && githubCheckInput.safeParse({ adminToken, repository: repository.trim() }).success,
    retry: false, staleTime: 60_000 });
  const check = useMutation({ mutationFn: () => load({ data: githubCheckInput.parse({ adminToken: getAdminToken(), repository: repository.trim(), ...(branch.trim() ? { branch: branch.trim() } : {}) }) }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["github-check-history"] }) });
  const result = !check.isPending && !check.isError ? check.data : undefined;
  const recovery = githubRecovery(check.error?.message ?? "");
  const unknown = t({ en: "Unavailable — check Project settings → Git", bn: "অনুপলব্ধ — Project settings → Git-এ দেখুন" });
  return (
    <section className="space-y-4 border-t border-border py-4" aria-label="GitHub repository status">
      <h2 className="flex items-center gap-2 font-semibold"><Github className="size-4 text-primary" />{t({ en: "GitHub repository status", bn: "GitHub রিপোজিটরির অবস্থা" })}</h2>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={e => { e.preventDefault(); setRetryUsed(false); check.mutate(); }}>
        <label className="min-w-0 flex-1 space-y-1 text-sm">{t({ en: "Repository to inspect", bn: "যে রিপোজিটরি যাচাই করবেন" })}<Input value={repository} maxLength={200} pattern="[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+" onChange={e => { setRepository(e.target.value); check.reset(); }} placeholder="owner/repository" required /></label>
        <label className="space-y-1 text-sm sm:w-48">{t({ en: "Branch (default if blank)", bn: "ব্রাঞ্চ (খালি হলে ডিফল্ট)" })}<Input value={branch} maxLength={200} onChange={e => { setBranch(e.target.value); check.reset(); }} /></label>
        <Button type="submit" variant="outline" disabled={check.isPending}><RefreshCw className={`size-4 ${check.isPending ? "animate-spin" : ""}`} />{t({ en: "Check GitHub", bn: "GitHub যাচাই" })}</Button>
      </form>
      {check.isError && <p role="alert" className="text-sm text-destructive">{check.error.message}</p>}
      {check.isError && <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">{recovery.kind === "access" ? t({ en: "Unlock IT Console with the full IT PIN, then check again.", bn: "পূর্ণ IT PIN দিয়ে IT Console খুলে আবার যাচাই করুন।" }) : recovery.kind === "connection" ? t({ en: "Check GitHub connection and repository access in Lovable connector settings before retrying.", bn: "আবার চেষ্টা করার আগে Lovable connector settings-এ GitHub সংযোগ ও অনুমতি দেখুন।" }) : recovery.kind === "repository" ? t({ en: "Verify the repository and branch, or check the default branch.", bn: "রিপোজিটরি ও ব্রাঞ্চ যাচাই করুন, অথবা ডিফল্ট ব্রাঞ্চ দেখুন।" }) : t({ en: "The read failed. Retry once; no repository changes will be made.", bn: "তথ্য পড়া যায়নি। একবার আবার চেষ্টা করুন; রিপোজিটরি বদলাবে না।" })}</p>
        <div className="flex flex-wrap gap-2">
          {recovery.retry && <Button variant="outline" disabled={retryUsed || check.isPending} onClick={() => { setRetryUsed(true); check.mutate(); }}><RefreshCw className="size-4" />{t({ en: "Retry once", bn: "একবার আবার চেষ্টা" })}</Button>}
          {branch.trim() && <Button variant="outline" disabled={check.isPending} onClick={() => { setBranch(""); setRetryUsed(false); check.reset(); }}>{t({ en: "Use default branch", bn: "ডিফল্ট ব্রাঞ্চ ব্যবহার" })}</Button>}
          <Button variant="outline" onClick={() => { check.reset(); setRetryUsed(false); }}>{t({ en: "Clear failed result", bn: "ব্যর্থ ফলাফল সরান" })}</Button>
        </div>
      </div>}
      {check.isPending && <p role="status" className="text-sm text-muted-foreground">{t({ en: "Checking…", bn: "যাচাই হচ্ছে…" })}</p>}
      {result && <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><Github className="size-4" /><a className="break-all underline" href={`https://github.com/${result.repository}`} target="_blank" rel="noreferrer">{result.repository}</a><span className="text-muted-foreground">{result.private ? "Private" : "Public"}</span></div>
        <p className="flex flex-wrap items-center gap-2"><GitBranch className="size-4" />{result.branch} · {result.sha.slice(0, 7)} · {result.protected ? "Protected branch" : "Not protected"}</p>
        <p>{t({ en: "Account access", bn: "অ্যাকাউন্টের অনুমতি" })}: {result.canRead === null ? "Unknown" : result.canRead ? "Read" : "No read"} / {result.canWrite === null ? "Write unknown" : result.canWrite ? "Write" : "No write"}</p>
        <p className="text-xs text-muted-foreground">{t({ en: "Checked", bn: "যাচাইয়ের সময়" })}: {new Date(result.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} Dhaka</p>
        {!result.historyRecorded && <p role="alert" className="text-destructive">{t({ en: "Check completed, but history could not be saved.", bn: "যাচাই সম্পন্ন, তবে ইতিহাস সংরক্ষণ হয়নি।" })}</p>}
        <h3 className="font-medium">{t({ en: "Recent GitHub Actions (latest 5)", bn: "সাম্প্রতিক GitHub Actions (শেষ ৫টি)" })}</h3>
        {result.runs.length ? <ul className="divide-y divide-border">{result.runs.map(run => <li key={run.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between"><a href={`https://github.com/${result.repository}/actions/runs/${run.id}`} target="_blank" rel="noreferrer" className="break-words underline">{run.name}</a><span className="text-muted-foreground">{run.conclusion ?? run.status} · {new Date(run.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</span></li>)}</ul> : <p className="text-muted-foreground">{t({ en: "No workflow runs returned for this branch.", bn: "এই ব্রাঞ্চে কোনো workflow run পাওয়া যায়নি।" })}</p>}
      </div>}
      <div className="space-y-3 border-t border-border pt-3 text-sm">
        <h3 className="font-medium">{t({ en: "Repository check history (latest 50)", bn: "রিপোজিটরি যাচাইয়ের ইতিহাস (শেষ ৫০টি)" })}</h3>
        {history.isLoading && <p role="status">{t({ en: "Loading history…", bn: "ইতিহাস আসছে…" })}</p>}
        {history.isError && <p role="alert" className="text-destructive">{history.error.message}</p>}
        {history.isError && <Button variant="outline" disabled={history.isFetching} onClick={() => void history.refetch()}><RefreshCw className="size-4" />{t({ en: "Reload saved history", bn: "সংরক্ষিত ইতিহাস আবার দেখুন" })}</Button>}
        {history.data?.length === 0 && <p className="text-muted-foreground">{t({ en: "No saved checks for this repository yet. Earlier chat checks were not recorded here.", bn: "এখনো এই রিপোজিটরির যাচাই সংরক্ষিত নেই। আগের চ্যাটের যাচাই এখানে রেকর্ড হয়নি।" })}</p>}
        <ol className="divide-y divide-border">{history.data?.map(entry => <li key={entry.id} className="space-y-2 py-3">
          <div className="flex flex-wrap justify-between gap-2"><time dateTime={entry.checkedAt}>{new Date(entry.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} Dhaka</time><strong className={entry.outcome === "failed" ? "text-destructive" : "text-foreground"}>{entry.outcome === "success" ? "Success" : "Failed"}</strong></div>
          <p className="break-all">{entry.repository} · {entry.branch ?? entry.requestedBranch ?? "Default branch"}{entry.sha ? ` · ${entry.sha.slice(0, 7)}` : ""}</p>
          {entry.outcome === "success" ? <p>{entry.private ? "Private" : "Public"} · Read: {entry.canRead === null ? "Unknown" : entry.canRead ? "Yes" : "No"} · Write: {entry.canWrite === null ? "Unknown" : entry.canWrite ? "Yes" : "No"} · {entry.protected ? "Protected" : "Not protected"}</p> : <p className="text-destructive">{entry.errorCode}</p>}
          {entry.runs.length > 0 && <ul className="space-y-1 text-xs text-muted-foreground">{entry.runs.map(run => <li key={run.id} className="break-words">{run.name}: {run.conclusion ?? run.status} · {new Date(run.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} Dhaka</li>)}</ul>}
          <p className="text-xs text-muted-foreground">Lovable sync: {t({ en: "Not verified", bn: "যাচাই হয়নি" })}</p>
        </li>)}</ol>
      </div>
      <div className="space-y-2 border-t border-border pt-3 text-sm">
        <h3 className="font-medium">Lovable Git sync</h3>
        <div className="space-y-2 border-l-2 border-primary pl-3" aria-label="Saved commit comparison">
          <p className="font-medium">{t({ en: "Last saved-commit comparison: matched", bn: "শেষ সংরক্ষিত কাজের তুলনা: মিলেছে" })}</p>
          <p className="break-all">trendfluxos-dev/winstone-pulse-crm · main</p>
          <a className="break-all underline" href="https://github.com/trendfluxos-dev/winstone-pulse-crm/commit/96b57651ea91d4133e49142fca809dde723b2223" target="_blank" rel="noopener noreferrer">96b57651ea91d4133e49142fca809dde723b2223</a>
          <p className="text-xs text-muted-foreground">{t({ en: "Compared in chat", bn: "চ্যাটে তুলনা করা হয়েছে" })}: <time dateTime="2026-10-30T15:19:45Z">30 Oct 2026 · 21:19:45 Dhaka</time></p>
          <p className="text-muted-foreground">{t({ en: "The project's saved commit and GitHub main head matched at that time. This dated evidence is not a live sync status; later edits are not covered.", bn: "ওই সময় প্রকল্পের সংরক্ষিত কাজ ও GitHub main-এর সর্বশেষ কাজ একই ছিল। এটি ওই সময়ের প্রমাণ, বর্তমান সিঙ্ক অবস্থা নয়; পরের পরিবর্তন এতে অন্তর্ভুক্ত নয়।" })}</p>
        </div>
        <p className="text-muted-foreground">{t({ en: "Current Lovable sync: not verified. GitHub access checks do not read the sync queue. Confirm Connected / In sync with GitHub in Lovable Project settings → Git → Re-check.", bn: "বর্তমান Lovable সিঙ্ক: যাচাই হয়নি। GitHub অ্যাক্সেস যাচাইয়ে সিঙ্কের অপেক্ষমাণ কাজ দেখা যায় না। Lovable Project settings → Git → Re-check-এ Connected / In sync with GitHub নিশ্চিত করুন।" })}</p>
        <dl className="grid gap-3 sm:grid-cols-2">{[t({ en: "Connected repository", bn: "সংযুক্ত রিপোজিটরি" }), t({ en: "Synced branch", bn: "সিঙ্ক ব্রাঞ্চ" }), t({ en: "Pending changes", bn: "অপেক্ষমাণ পরিবর্তন" }), t({ en: "Recent sync errors", bn: "সাম্প্রতিক সিঙ্ক ত্রুটি" })].map(label => <div key={label}><dt>{label}</dt><dd className="text-xs text-muted-foreground">{unknown}</dd></div>)}</dl>
      </div>
    </section>
  );
}