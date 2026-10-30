import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Download, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { getAndroidBuilds } from "@/lib/github-status.functions";
import { useT } from "@/lib/i18n";

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const when = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) : "—";

/** Read-only Android APK build tracker (full IT PIN). Polls while a build runs and alerts once artifacts are ready. */
export function AndroidBuildStatus() {
  const t = useT();
  const adminToken = useAdminToken();
  const [repository, setRepository] = useState("Winstone-BD/winstone-pulse-crm");
  const [watching, setWatching] = useState(false);
  const load = useServerFn(getAndroidBuilds);
  const valid = REPO_RE.test(repository.trim());
  const q = useQuery({
    queryKey: ["android-builds", repository.trim()],
    queryFn: () => load({ data: { adminToken: getAdminToken(), repository: repository.trim() } }),
    enabled: watching && !!adminToken && valid,
    refetchInterval: (query) => { const r = query.state.data?.runs[0]; return r && r.status !== "completed" ? 30000 : false; },
    retry: false,
  });
  const latest = q.data?.runs[0];
  const ready = latest?.status === "completed" && latest.conclusion === "success" && q.data!.artifacts.some((a) => !a.expired);
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!latest) return;
    const key = `${latest.id}:${latest.status}:${latest.conclusion}`;
    const wasRunning = prev.current?.startsWith(`${latest.id}:`) && !prev.current.includes(":completed:");
    prev.current = key;
    if (!wasRunning || latest.status !== "completed") return;
    const msg = ready ? t({ en: "Android APK is ready to download", bn: "Android APK ডাউনলোডের জন্য প্রস্তুত" }) : t({ en: "Android build finished without a downloadable APK", bn: "Android build শেষ, কিন্তু ডাউনলোডযোগ্য APK নেই" });
    ready ? toast.success(msg) : toast.error(msg);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Winstone Pulse", { body: msg });
  }, [latest, ready, t]);

  const label = !latest ? "—" : latest.status !== "completed" ? t({ en: "Building…", bn: "তৈরি হচ্ছে…" }) : latest.conclusion === "success" ? t({ en: "Succeeded", bn: "সফল" }) : t({ en: `Failed (${latest.conclusion})`, bn: `ব্যর্থ (${latest.conclusion})` });

  return (
    <section className="card-elevated space-y-4 p-5" aria-label="Android build status">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-primary" />{t({ en: "Android APK build status", bn: "Android APK build অবস্থা" })}</h2>
        <p className="text-xs text-muted-foreground">{t({ en: "Watches the \"Android APKs\" GitHub workflow. Checks every 30 seconds while a build runs. Read-only; it never starts a build.", bn: "GitHub-এর \"Android APKs\" workflow দেখে। build চলাকালীন প্রতি ৩০ সেকেন্ডে যাচাই করে। শুধু দেখা যায়; নিজে build শুরু করে না।" })}</p>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (!valid) return; if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); watching ? void q.refetch() : setWatching(true); }}>
        <Input value={repository} maxLength={200} onChange={(e) => { setRepository(e.target.value); setWatching(false); prev.current = null; }} placeholder="owner/repository" aria-label={t({ en: "Repository", bn: "রিপোজিটরি" })} />
        <Button type="submit" disabled={!adminToken || !valid || q.isFetching}>
          {watching ? <RefreshCw className={q.isFetching ? "size-4 animate-spin" : "size-4"} /> : <Bell className="size-4" />}
          {watching ? t({ en: "Refresh", bn: "রিফ্রেশ" }) : t({ en: "Watch builds", bn: "build দেখুন" })}
        </Button>
      </form>
      {!adminToken && <p className="text-sm text-muted-foreground">{t({ en: "Unlock IT Console with the full IT PIN first.", bn: "আগে পূর্ণ IT PIN দিয়ে IT Console খুলুন।" })}</p>}
      {q.isError && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && !q.data.workflowFound && <p className="text-sm text-muted-foreground">{t({ en: "This repository has no \"Android APKs\" workflow.", bn: "এই রিপোজিটরিতে \"Android APKs\" workflow নেই।" })}</p>}
      {q.data?.workflowFound && !latest && <p className="text-sm text-muted-foreground">{t({ en: "No Android builds have run yet.", bn: "এখনো কোনো Android build চলেনি।" })}</p>}
      {latest && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={ready ? "default" : latest.status === "completed" ? "destructive" : "secondary"}>{label}</Badge>
            <span className="text-muted-foreground">{latest.branch} · {latest.sha} · {when(latest.startedAt)}</span>
            <a className="text-primary underline" href={latest.url} target="_blank" rel="noreferrer">{t({ en: "Open on GitHub", bn: "GitHub-এ খুলুন" })}</a>
          </div>
          {latest.status !== "completed" && <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 animate-pulse rounded-full bg-primary" /></div>}
          {latest.status === "completed" && q.data!.artifacts.length > 0 && (
            <ul className="space-y-2">
              {q.data!.artifacts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <ArtifactFacts a={a} version={latest.version} />
                  {a.expired ? <Badge variant="outline">{t({ en: "Expired", bn: "মেয়াদোত্তীর্ণ" })}</Badge> : (
                    <Button asChild size="sm"><a href={a.url} target="_blank" rel="noreferrer"><Download className="size-4" />{t({ en: "Download", bn: "ডাউনলোড" })}</a></Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {q.data!.runs.length > 1 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t({ en: "Recent builds", bn: "সাম্প্রতিক build" })}</h3>
              <ul className="divide-y divide-border rounded-md border text-sm">
                {q.data!.runs.slice(1).map((r) => {
                  const ok = r.status === "completed" && r.conclusion === "success";
                  const live = r.artifacts.filter((a) => !a.expired);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 p-2">
                      <Badge variant={ok ? "default" : r.status === "completed" ? "destructive" : "secondary"}>{r.status !== "completed" ? t({ en: "Building", bn: "চলছে" }) : ok ? t({ en: "Succeeded", bn: "সফল" }) : t({ en: `Failed (${r.conclusion})`, bn: `ব্যর্থ (${r.conclusion})` })}</Badge>
                      <span className="text-muted-foreground">{when(r.startedAt)} · {r.sha}</span>
                      <a className="text-primary underline" href={r.url} target="_blank" rel="noreferrer">GitHub</a>
                      <span className="ml-auto flex flex-wrap gap-1">
                        {live.length === 0 ? <span className="text-xs text-muted-foreground">{r.artifacts.length ? t({ en: "Downloads expired", bn: "ডাউনলোড মেয়াদোত্তীর্ণ" }) : t({ en: "No downloads", bn: "ডাউনলোড নেই" })}</span>
                          : <span className="flex w-full flex-col gap-1">{live.map((a) => <span key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-2"><ArtifactFacts a={a} version={r.version} /><Button asChild size="sm" variant="outline"><a href={a.url} target="_blank" rel="noreferrer"><Download className="size-3" />{t({ en: "Download", bn: "ডাউনলোড" })}</a></Button></span>)}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{t({ en: "Downloads need a GitHub sign-in with access to this repository. Checked", bn: "ডাউনলোডে এই রিপোজিটরিতে অ্যাক্সেস থাকা GitHub লগইন লাগবে। যাচাই" })}: {when(q.data!.checkedAt)}</p>
        </div>
      )}
    </section>
  );
}

function ArtifactFacts({ a, version }: { a: { name: string; sizeBytes: number; sizeMb: number; sha256: string | null }; version: string | null }) {
  const t = useT();
  return (
    <span className="min-w-0 space-y-0.5 text-xs">
      <span className="block truncate text-sm font-medium">{a.name}</span>
      <span className="block text-muted-foreground">{t({ en: "Version", bn: "ভার্সন" })}: {version ?? t({ en: "unknown", bn: "অজানা" })} · {a.sizeMb} MB ({a.sizeBytes.toLocaleString()} bytes)</span>
      <span className="block break-all font-mono text-muted-foreground">{t({ en: "Download ZIP SHA-256", bn: "ডাউনলোড ZIP SHA-256" })}: {a.sha256 ?? t({ en: "not provided by GitHub", bn: "GitHub দেয়নি" })}</span>
      {a.sha256 && <ChecksumVerifier expected={a.sha256} />}
    </span>
  );
}

/** Hashes a downloaded file locally in the browser (never uploaded) and compares it with GitHub's SHA-256. */
function ChecksumVerifier({ expected }: { expected: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "checking" | "match" | "mismatch" | "error">("idle");
  async function onFile(file: File | undefined) {
    if (!file) return;
    setState("checking");
    try {
      const { sha256Hex, checksumMatches } = await import("@/lib/checksum");
      setState(checksumMatches(await sha256Hex(await file.arrayBuffer()), expected) ? "match" : "mismatch");
    } catch { setState("error"); }
  }
  const label = { idle: t({ en: "Not verified yet", bn: "এখনও যাচাই হয়নি" }), checking: t({ en: "Checking…", bn: "যাচাই চলছে…" }), match: t({ en: "✓ Checksum matches — file is genuine", bn: "✓ চেকসাম মিলেছে — ফাইল আসল" }), mismatch: t({ en: "✗ Checksum does NOT match — do not install", bn: "✗ চেকসাম মেলেনি — ইনস্টল করবেন না" }), error: t({ en: "Could not read file", bn: "ফাইল পড়া যায়নি" }) }[state];
  const variant = state === "match" ? "default" : state === "mismatch" || state === "error" ? "destructive" : "outline";
  return (
    <span className="flex flex-wrap items-center gap-2 pt-1">
      <label className="cursor-pointer text-primary underline">
        {t({ en: "Verify downloaded ZIP", bn: "ডাউনলোড করা ZIP যাচাই" })}
        <input type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <Badge variant={variant}>{label}</Badge>
    </span>
  );
}
