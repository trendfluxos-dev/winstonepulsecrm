import { classifyAccess, GITHUB_KEY_NAMES, type RepoVisibility } from "@/lib/github-access";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";

type Invite = { repository?: { full_name?: string }; inviter?: { login?: string }; created_at?: string };

/** Read-only: per linked GitHub credential, which account it is, whether it sees the repo, and pending invites. */
export async function readGithubAccess(repository: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("GitHub connection is not configured");
  const slots = GITHUB_KEY_NAMES.map((name) => ({ name, key: process.env[name] })).filter((s): s is { name: typeof GITHUB_KEY_NAMES[number]; key: string } => !!s.key);
  if (slots.length === 0) throw new Error("No GitHub connection is linked");

  const connections = await Promise.all(slots.map(async ({ name, key }, index) => {
    const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": key };
    const get = (path: string) => fetch(`${GATEWAY_URL}${path}`, { headers, signal: AbortSignal.timeout(10000), redirect: "error" });
    let login: string | null = null;
    let visibility: RepoVisibility = "error";
    let repoPrivate: boolean | null = null;
    let canPush: boolean | null = null;
    let invites: Array<{ inviter: string | null; createdAt: string | null }> = [];
    try {
      const [userRes, repoRes, invRes] = await Promise.all([get("/user"), get(`/repos/${repository}`), get("/user/repository_invitations?per_page=100")]);
      if (userRes.ok) login = ((await userRes.json()) as { login?: string }).login ?? null;
      if (repoRes.ok) {
        const repo = (await repoRes.json()) as { private?: boolean; permissions?: { push?: boolean } };
        visibility = "visible"; repoPrivate = repo.private ?? null; canPush = repo.permissions?.push ?? null;
      } else if (repoRes.status === 404) visibility = "not_found";
      else console.error(`GitHub access repo read failed [${repoRes.status}]`);
      if (invRes.ok) {
        const all = (await invRes.json()) as Invite[];
        invites = all.filter((i) => i.repository?.full_name?.toLowerCase() === repository.toLowerCase())
          .map((i) => ({ inviter: i.inviter?.login ?? null, createdAt: i.created_at ?? null }));
      }
    } catch {
      console.error("GitHub access read failed");
    }
    return {
      slot: index === 0 ? "primary" as const : "additional" as const,
      usedByApp: name === "GITHUB_API_KEY",
      login, visibility, repoPrivate, canPush, invites,
      verdict: classifyAccess(visibility, invites.length > 0),
    };
  }));
  return { repository, checkedAt: new Date().toISOString(), connections };
}
