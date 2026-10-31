import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { getGithubAccess } from "@/lib/github-status.functions";
import { CRM_REPOSITORY, type AccessVerdict } from "@/lib/github-access";
import { useT } from "@/lib/i18n";

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const when = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) : "—";

/** Read-only GitHub access check (full IT PIN). Never changes connections or the repository. */
export function GitHubAccessPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const [repository, setRepository] = useState(CRM_REPOSITORY);
  const load = useServerFn(getGithubAccess);
  const run = useMutation({ mutationFn: () => load({ data: { adminToken: getAdminToken(), repository: repository.trim() } }) });
  const valid = REPO_RE.test(repository.trim());
  // Last successful repository-access verification per account, kept on this device only.
  const STORE = "winstone.githubAccessVerified";
  const [lastVerified, setLastVerified] = useState<Record<string, string>>({});
  useEffect(() => { try { setLastVerified(JSON.parse(localStorage.getItem(STORE) ?? "{}")); } catch { /* ignore */ } }, []);
  useEffect(() => {
    if (!run.data) return;
    const next = { ...lastVerified };
    for (const c of run.data.connections) if (c.login && c.verdict === "ready") next[`${run.data.repository.toLowerCase()}|${c.login}`] = c.checkedAt;
    setLastVerified(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.data]);

  const verdictText: Record<AccessVerdict, { en: string; bn: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ready: { en: "Can see repository", bn: "রিপোজিটরি দেখা যায়", variant: "default" },
    invite_pending: { en: "Invitation waiting — accept it", bn: "আমন্ত্রণ অপেক্ষমাণ — গ্রহণ করুন", variant: "secondary" },
    no_access: { en: "No access", bn: "অ্যাক্সেস নেই", variant: "destructive" },
    check_failed: { en: "Check failed", bn: "যাচাই ব্যর্থ", variant: "outline" },
  };

  return (
    <section className="card-elevated space-y-4 p-5" aria-label="GitHub access">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="size-4 text-primary" />{t({ en: "GitHub access status", bn: "GitHub অ্যাক্সেস অবস্থা" })}</h2>
        <p className="text-xs text-muted-foreground">{t({ en: "Which GitHub account each linked connection uses, whether it can see the repository, and pending invitations. Read-only.", bn: "প্রতিটি সংযোগ কোন GitHub অ্যাকাউন্ট, রিপোজিটরি দেখা যায় কি না, ও অপেক্ষমাণ আমন্ত্রণ। শুধু দেখা যাবে।" })}</p>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (valid) run.mutate(); }}>
        <Input value={repository} maxLength={200} onChange={(e) => { setRepository(e.target.value); run.reset(); }} placeholder="owner/repository" aria-label={t({ en: "Repository", bn: "রিপোজিটরি" })} />
        <Button type="submit" disabled={!adminToken || !valid || run.isPending}>
          <RefreshCw className={run.isPending ? "size-4 animate-spin" : "size-4"} />
          {t({ en: "Check access", bn: "অ্যাক্সেস যাচাই" })}
        </Button>
      </form>
      {!adminToken && <p className="text-sm text-muted-foreground">{t({ en: "Unlock IT Console with the full IT PIN first.", bn: "আগে পূর্ণ IT PIN দিয়ে IT Console খুলুন।" })}</p>}
      {run.isError && <p className="text-sm text-destructive">{(run.error as Error).message}</p>}
      {run.data && (
        <div className="space-y-2">
          {run.data.connections.map((c, i) => {
            const v = verdictText[c.verdict];
            const profileUrl = c.login ? `https://github.com/${encodeURIComponent(c.login)}` : null;
            return (
              <div key={i} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {profileUrl ? (
                    <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline decoration-border underline-offset-2 hover:decoration-foreground" aria-label={t({ en: "Open GitHub profile", bn: "GitHub প্রোফাইল খুলুন" })}>
                      {c.login}
                      <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="font-medium">{t({ en: "Unknown account", bn: "অজানা অ্যাকাউন্ট" })}</span>
                  )}
                  <Badge variant={v.variant}>{t(v)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.usedByApp ? t({ en: "Used by these System panels", bn: "এই System প্যানেলগুলো এটি ব্যবহার করে" }) : t({ en: "Linked but not used by the panels", bn: "সংযুক্ত, তবে প্যানেলগুলো ব্যবহার করে না" })}
                  {c.visibility === "visible" && <> · {c.repoPrivate ? t({ en: "Private repository", bn: "প্রাইভেট রিপোজিটরি" }) : t({ en: "Public repository", bn: "পাবলিক রিপোজিটরি" })} · {c.canPush ? t({ en: "can write", bn: "লেখা যায়" }) : t({ en: "read only", bn: "শুধু পড়া" })}</>}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t({ en: "Checked", bn: "যাচাই" })}: {when(c.checkedAt)} · {t({ en: "Access last verified", bn: "সর্বশেষ অ্যাক্সেস নিশ্চিত" })}: {c.login && lastVerified[`${run.data.repository.toLowerCase()}|${c.login}`] ? when(lastVerified[`${run.data.repository.toLowerCase()}|${c.login}`]) : t({ en: "never on this device", bn: "এই ডিভাইসে কখনো নয়" })}
                </p>
                {c.invites.map((inv, j) => (
                  <p key={j} className="mt-1 text-xs">{t({ en: "Invitation from", bn: "আমন্ত্রণ পাঠিয়েছেন" })} {inv.inviter ?? "—"} · {when(inv.createdAt)} — {t({ en: "accept it at github.com/notifications while signed in as this account.", bn: "এই অ্যাকাউন্টে লগইন করে github.com/notifications থেকে গ্রহণ করুন।" })}</p>
                ))}
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground">{t({ en: "Checked", bn: "যাচাই" })}: {when(run.data.checkedAt)}</p>
        </div>
      )}
    </section>
  );
}
