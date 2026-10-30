const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";

/** Bounded read-only GitHub facts; none of these establish Lovable Git sync. */
export async function readGithubStatus(repository: string, branch: string | undefined) {
  const key = process.env["GITHUB_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!key || !lovableKey) throw new Error("GitHub connection is not configured");
  const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": key };
  async function read(path: string): Promise<unknown> {
    const response = await fetch(`${GATEWAY_URL}${path}`, {
      headers,
      signal: AbortSignal.timeout(10000), redirect: "error",
    });
    if (!response.ok) {
      // Do not expose arbitrary upstream text or credentials through the UI.
      console.error(`GitHub status read failed [${response.status}]`);
      throw new Error(`GitHub read failed (HTTP ${response.status})`);
    }
    return response.json();
  }
  const repo = await read(`/repos/${repository}`) as { full_name: string; private: boolean; default_branch: string; permissions?: { pull?: boolean; push?: boolean } };
  const selectedBranch = branch || repo.default_branch;
  const [head, workflows] = await Promise.all([
    read(`/repos/${repository}/branches/${encodeURIComponent(selectedBranch)}`),
    read(`/repos/${repository}/actions/runs?branch=${encodeURIComponent(selectedBranch)}&per_page=5`),
  ]) as [{ name: string; commit: { sha: string }; protected: boolean }, { workflow_runs?: Array<{ id: number; name: string; status: string; conclusion: string | null; updated_at: string }> }];
  return {
    repository: repo.full_name, private: repo.private, branch: head.name, sha: head.commit.sha,
    protected: head.protected, canRead: repo.permissions?.pull ?? null, canWrite: repo.permissions?.push ?? null,
    checkedAt: new Date().toISOString(),
    runs: (workflows.workflow_runs ?? []).slice(0, 5).map(r => ({ id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, updatedAt: r.updated_at })),
    // Unknown is never zero or 'no errors'. GitHub does not expose Lovable's queue.
    connectedRepository: null, syncedBranch: null, pendingChanges: null, syncErrors: null,
  };
}
type GhCommit = { sha: string; html_url: string; commit: { message: string; author?: { name?: string; date?: string } | null }; author?: { login?: string } | null };
type GhIssue = { number: number; title: string; html_url: string; state: string; user?: { login?: string } | null; updated_at: string; comments: number; pull_request?: unknown };
type GhPull = { number: number; title: string; html_url: string; state: string; draft?: boolean; merged_at: string | null; user?: { login?: string } | null; updated_at: string };

/** Bounded read-only summary of recent commits, issues and pull requests. */
export async function readGithubActivity(repository: string) {
  const key = process.env["GITHUB_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!key || !lovableKey) throw new Error("GitHub connection is not configured");
  const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": key };
  async function read<T>(path: string): Promise<T> {
    const response = await fetch(`${GATEWAY_URL}${path}`, { headers, signal: AbortSignal.timeout(10000), redirect: "error" });
    if (!response.ok) {
      console.error(`GitHub activity read failed [${response.status}]`);
      throw new Error(`GitHub read failed (HTTP ${response.status})`);
    }
    return response.json() as Promise<T>;
  }
  const [commits, issues, pulls] = await Promise.all([
    read<GhCommit[]>(`/repos/${repository}/commits?per_page=10`),
    read<GhIssue[]>(`/repos/${repository}/issues?state=all&sort=updated&per_page=30`),
    read<GhPull[]>(`/repos/${repository}/pulls?state=all&sort=updated&direction=desc&per_page=10`),
  ]);
  const realIssues = issues.filter((i) => !i.pull_request);
  return {
    repository,
    checkedAt: new Date().toISOString(),
    commits: commits.slice(0, 10).map((c) => ({
      sha: c.sha.slice(0, 7), url: c.html_url,
      message: (c.commit.message.split("\n")[0] ?? "").slice(0, 160),
      author: c.author?.login ?? c.commit.author?.name ?? "unknown",
      date: c.commit.author?.date ?? null,
    })),
    issues: realIssues.slice(0, 10).map((i) => ({ number: i.number, title: i.title.slice(0, 160), url: i.html_url, state: i.state, author: i.user?.login ?? "unknown", updatedAt: i.updated_at, comments: i.comments })),
    openIssueCount: realIssues.filter((i) => i.state === "open").length,
    pulls: pulls.slice(0, 10).map((p) => ({ number: p.number, title: p.title.slice(0, 160), url: p.html_url, state: p.merged_at ? "merged" : p.draft ? "draft" : p.state, author: p.user?.login ?? "unknown", updatedAt: p.updated_at })),
    openPullCount: pulls.filter((p) => p.state === "open").length,
  };
}

type GhRun = { id: number; status: string; conclusion: string | null; html_url: string; head_sha: string; head_branch: string; created_at: string; updated_at: string; run_started_at?: string };
type GhArtifact = { id: number; name: string; size_in_bytes: number; expired: boolean; expires_at: string | null };

/** Read-only: latest runs of the Android APK workflow and artifacts of the newest one. Never triggers builds. */
export async function readAndroidBuilds(repository: string) {
  const key = process.env["GITHUB_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!key || !lovableKey) throw new Error("GitHub connection is not configured");
  const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": key };
  async function read<T>(path: string): Promise<T | null> {
    const response = await fetch(`${GATEWAY_URL}${path}`, { headers, signal: AbortSignal.timeout(10000), redirect: "error" });
    if (response.status === 404) return null;
    if (!response.ok) {
      console.error(`GitHub build read failed [${response.status}]`);
      throw new Error(`GitHub read failed (HTTP ${response.status})`);
    }
    return response.json() as Promise<T>;
  }
  const runs = await read<{ workflow_runs: GhRun[] }>(`/repos/${repository}/actions/workflows/android-apk.yml/runs?per_page=10`);
  const list = runs?.workflow_runs ?? [];
  const latest = list[0];
  const mapArt = (runId: number, a: GhArtifact) => ({ id: a.id, name: a.name.slice(0, 120), sizeMb: Math.round(a.size_in_bytes / 104857.6) / 10, expired: a.expired, expiresAt: a.expires_at, url: `https://github.com/${repository}/actions/runs/${runId}/artifacts/${a.id}` });
  const artsByRun = await Promise.all(list.map(async (r) => r.status === "completed"
    ? ((await read<{ artifacts: GhArtifact[] }>(`/repos/${repository}/actions/runs/${r.id}/artifacts?per_page=20`))?.artifacts ?? []).map((a) => mapArt(r.id, a))
    : []));
  return {
    repository,
    workflowFound: runs !== null,
    checkedAt: new Date().toISOString(),
    runs: list.map((r, i) => ({ id: r.id, status: r.status, conclusion: r.conclusion, url: r.html_url, sha: r.head_sha.slice(0, 7), branch: r.head_branch, startedAt: r.run_started_at ?? r.created_at, updatedAt: r.updated_at, artifacts: artsByRun[i] ?? [] })),
    artifacts: artsByRun[0] ?? [],
  };
}

