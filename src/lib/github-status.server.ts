const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";

/**
 * The first linked GitHub credential (in GITHUB_KEY_NAMES order) that can see the repository.
 * Several accounts are linked; the CRM code copy moved to an account the first key can't see,
 * so always reading GITHUB_API_KEY made every IT Console GitHub view fail with 404.
 */
async function githubKeyFor(repository: string): Promise<string> {
  const { GITHUB_KEY_NAMES } = await import("@/lib/github-access");
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const keys = GITHUB_KEY_NAMES.map((n) => process.env[n]).filter((k): k is string => !!k);
  if (!lovableKey || keys.length === 0) throw new Error("GitHub connection is not configured");
  if (keys.length === 1) return keys[0]!;
  for (const key of keys) {
    try {
      const res = await fetch(`${GATEWAY_URL}/repos/${repository}`, {
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": key },
        signal: AbortSignal.timeout(10000), redirect: "error",
      });
      if (res.ok) return key;
    } catch { /* try the next linked account */ }
  }
  // None can see it: keep the first key so callers report GitHub's own status (e.g. 404).
  return keys[0]!;
}

/** Bounded read-only GitHub facts; none of these establish Lovable Git sync. */
export async function readGithubStatus(repository: string, branch: string | undefined) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("GitHub connection is not configured");
  const key = await githubKeyFor(repository);
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
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("GitHub connection is not configured");
  const key = await githubKeyFor(repository);
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
type GhArtifact = { id: number; name: string; size_in_bytes: number; expired: boolean; expires_at: string | null; digest?: string | null };

/** Pure: read versionName/versionCode from build.gradle.kts text; null when absent. */
export function parseApkVersion(gradle: string | null): string | null {
  if (!gradle) return null;
  const name = /versionName\s*=\s*"([^"]{1,40})"/.exec(gradle)?.[1];
  const code = /versionCode\s*=\s*(\d{1,9})/.exec(gradle)?.[1];
  return name ? (code ? `${name} (${code})` : name) : null;
}

/** Pure: GitHub artifact digest "sha256:<hex>" → hex, else null. */
export function parseSha256(digest: string | null | undefined): string | null {
  const m = /^sha256:([a-f0-9]{64})$/i.exec(digest ?? "");
  return m ? m[1]!.toLowerCase() : null;
}

/** Read-only: latest runs of the Android APK workflow and artifacts of the newest one. Never triggers builds. */
export async function readAndroidBuilds(repository: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("GitHub connection is not configured");
  const key = await githubKeyFor(repository);
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
  const versions = new Map<string, string | null>();
  async function versionAt(sha: string) {
    if (versions.has(sha)) return versions.get(sha)!;
    let v: string | null = null;
    try {
      const res = await fetch(`${GATEWAY_URL}/repos/${repository}/contents/android/app/build.gradle.kts?ref=${sha}`, { headers: { ...headers, Accept: "application/vnd.github.raw" }, signal: AbortSignal.timeout(10000), redirect: "error" });
      if (res.ok) v = parseApkVersion((await res.text()).slice(0, 20000));
    } catch { v = null; }
    versions.set(sha, v);
    return v;
  }
  const mapArt = (runId: number, a: GhArtifact) => ({ id: a.id, name: a.name.slice(0, 120), sizeBytes: a.size_in_bytes, sha256: parseSha256(a.digest), sizeMb: Math.round(a.size_in_bytes / 104857.6) / 10, expired: a.expired, expiresAt: a.expires_at, url: `https://github.com/${repository}/actions/runs/${runId}/artifacts/${a.id}` });
  const artsByRun = await Promise.all(list.map(async (r) => r.status === "completed"
    ? ((await read<{ artifacts: GhArtifact[] }>(`/repos/${repository}/actions/runs/${r.id}/artifacts?per_page=20`))?.artifacts ?? []).map((a) => mapArt(r.id, a))
    : []));
  const runVersions = await Promise.all(list.map((r, i) => (artsByRun[i]?.length ? versionAt(r.head_sha) : Promise.resolve(null))));
  return {
    repository,
    workflowFound: runs !== null,
    checkedAt: new Date().toISOString(),
    runs: list.map((r, i) => ({ id: r.id, status: r.status, conclusion: r.conclusion, url: r.html_url, sha: r.head_sha.slice(0, 7), branch: r.head_branch, startedAt: r.run_started_at ?? r.created_at, updatedAt: r.updated_at, version: runVersions[i] ?? null, artifacts: artsByRun[i] ?? [] })),
    artifacts: artsByRun[0] ?? [],
  };
}


/**
 * Read-only: which Android signing secret NAMES and the fingerprint variable NAME exist in the
 * repository's Actions settings. GitHub never returns secret values here; variable values are
 * dropped too. A failed read is "check_failed", never "missing".
 */
export async function readAndroidSigningReadiness(repository: string) {
  const { classifySigningReadiness } = await import("@/lib/android-signing-readiness");
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("GitHub connection is not configured");
  const key = await githubKeyFor(repository);
  const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": key };
  async function names(path: string, field: "secrets" | "variables"): Promise<{ list: string[] | null; status: number | null }> {
    try {
      const response = await fetch(`${GATEWAY_URL}${path}`, { headers, signal: AbortSignal.timeout(10000), redirect: "error" });
      if (!response.ok) {
        console.error(`GitHub signing-readiness read failed [${response.status}]`);
        return { list: null, status: response.status };
      }
      const body = (await response.json()) as Record<string, Array<{ name?: unknown }> | undefined>;
      return { list: (body[field] ?? []).map((e) => String(e.name ?? "")).filter(Boolean), status: response.status };
    } catch {
      return { list: null, status: null };
    }
  }
  const [secrets, variables] = await Promise.all([
    names(`/repos/${repository}/actions/secrets?per_page=100`, "secrets"),
    names(`/repos/${repository}/actions/variables?per_page=30`, "variables"),
  ]);
  return {
    repository,
    checkedAt: new Date().toISOString(),
    readStatus: secrets.status === 403 || variables.status === 403 ? "no_admin_access" as const
      : secrets.list === null || variables.list === null ? "error" as const : "ok" as const,
    ...classifySigningReadiness(secrets.list, variables.list),
  };
}
