import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GitBranch, Github, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminToken } from "@/lib/local-session";
import { getGithubRepositoryStatus } from "@/lib/github-status.functions";
import { useT } from "@/lib/i18n";

export function GitRepositoryStatusPanel() {
  const t = useT();
  const [repository, setRepository] = useState("Winstone-BD/winstone-pulse-crm");
  const [branch, setBranch] = useState("");
  const load = useServerFn(getGithubRepositoryStatus);
  const check = useMutation({ mutationFn: () => load({ data: { adminToken: getAdminToken(), repository: repository.trim(), ...(branch.trim() ? { branch: branch.trim() } : {}) } }) });
  const result = !check.isPending && !check.isError ? check.data : undefined;
  const unknown = t({ en: "Unavailable — check Project settings → Git", bn: "অনুপলব্ধ — Project settings → Git-এ দেখুন" });
  return (
    <section className="space-y-4 border-t border-border py-4" aria-label="GitHub repository status">
      <h2 className="flex items-center gap-2 font-semibold"><Github className="size-4 text-primary" />{t({ en: "GitHub repository status", bn: "GitHub রিপোজিটরির অবস্থা" })}</h2>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={e => { e.preventDefault(); check.mutate(); }}>
        <label className="min-w-0 flex-1 space-y-1 text-sm">{t({ en: "Repository to inspect", bn: "যে রিপোজিটরি যাচাই করবেন" })}<Input value={repository} onChange={e => { setRepository(e.target.value); check.reset(); }} placeholder="owner/repository" required /></label>
        <label className="space-y-1 text-sm sm:w-48">{t({ en: "Branch (default if blank)", bn: "ব্রাঞ্চ (খালি হলে ডিফল্ট)" })}<Input value={branch} onChange={e => { setBranch(e.target.value); check.reset(); }} /></label>
        <Button type="submit" variant="outline" disabled={check.isPending}><RefreshCw className={`size-4 ${check.isPending ? "animate-spin" : ""}`} />{t({ en: "Check GitHub", bn: "GitHub যাচাই" })}</Button>
      </form>
      {check.isError && <p role="alert" className="text-sm text-destructive">{check.error.message}</p>}
      {check.isPending && <p role="status" className="text-sm text-muted-foreground">{t({ en: "Checking…", bn: "যাচাই হচ্ছে…" })}</p>}
      {result && <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><Github className="size-4" /><a className="break-all underline" href={`https://github.com/${result.repository}`} target="_blank" rel="noreferrer">{result.repository}</a><span className="text-muted-foreground">{result.private ? "Private" : "Public"}</span></div>
        <p className="flex flex-wrap items-center gap-2"><GitBranch className="size-4" />{result.branch} · {result.sha.slice(0, 7)} · {result.protected ? "Protected branch" : "Not protected"}</p>
        <p>{t({ en: "Account access", bn: "অ্যাকাউন্টের অনুমতি" })}: {result.canRead === null ? "Unknown" : result.canRead ? "Read" : "No read"} / {result.canWrite === null ? "Write unknown" : result.canWrite ? "Write" : "No write"}</p>
        <p className="text-xs text-muted-foreground">{t({ en: "Checked", bn: "যাচাইয়ের সময়" })}: {new Date(result.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} Dhaka</p>
        <h3 className="font-medium">{t({ en: "Recent GitHub Actions (latest 5)", bn: "সাম্প্রতিক GitHub Actions (শেষ ৫টি)" })}</h3>
        {result.runs.length ? <ul className="divide-y divide-border">{result.runs.map(run => <li key={run.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between"><a href={`https://github.com/${result.repository}/actions/runs/${run.id}`} target="_blank" rel="noreferrer" className="break-words underline">{run.name}</a><span className="text-muted-foreground">{run.conclusion ?? run.status} · {new Date(run.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</span></li>)}</ul> : <p className="text-muted-foreground">{t({ en: "No workflow runs returned for this branch.", bn: "এই ব্রাঞ্চে কোনো workflow run পাওয়া যায়নি।" })}</p>}
      </div>}
      <div className="space-y-2 border-t border-border pt-3 text-sm">
        <h3 className="font-medium">Lovable Git sync</h3>
        <dl className="grid gap-3 sm:grid-cols-2">{[t({ en: "Connected repository", bn: "সংযুক্ত রিপোজিটরি" }), t({ en: "Synced branch", bn: "সিঙ্ক ব্রাঞ্চ" }), t({ en: "Pending changes", bn: "অপেক্ষমাণ পরিবর্তন" }), t({ en: "Recent sync errors", bn: "সাম্প্রতিক সিঙ্ক ত্রুটি" })].map(label => <div key={label}><dt>{label}</dt><dd className="text-xs text-muted-foreground">{unknown}</dd></div>)}</dl>
      </div>
    </section>
  );
}