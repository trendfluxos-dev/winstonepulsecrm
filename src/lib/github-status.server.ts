const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";

/** Bounded read-only GitHub facts; none of these establish Lovable Git sync. */
export async function readGithubStatus(repository: string, branch: string | undefined) {
  const key = process.env["GITHUB_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!key || !lovableKey) throw new Error("GitHub connection is not configured");
  async function read(path: string): Promise<unknown> {
    const response = await fetch(`${GATEWAY_URL}${path}`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": key },
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