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
      key: name,
      slot: index === 0 ? "primary" as const : "additional" as const,
      usedByApp: name === "GITHUB_API_KEY",
      login, visibility, repoPrivate, canPush, invites,
      verdict: classifyAccess(visibility, invites.length > 0),
      checkedAt: new Date().toISOString(),
    };
  }));
  return { repository, checkedAt: new Date().toISOString(), connections };
}

const WATCH_KEY = "github_access_watch";

/** Scheduled watch: compare repository access to the last saved state and alert HQ/IT on changes. Read-only on GitHub. */
export async function runGithubAccessWatch() {
  const { WATCHED_REPOSITORY, diffAccess, mergeSnapshot } = await import("@/lib/github-access");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await readGithubAccess(WATCHED_REPOSITORY);
  const current = result.connections.map((c) => ({ key: c.key, login: c.login, verdict: c.verdict, canPush: c.canPush }));
  const { data: stored, error: readError } = await supabaseAdmin.from("system_settings").select("value").eq("key", WATCH_KEY).maybeSingle();
  if (readError) throw new Error("Access watch state unavailable");
  const previous = ((stored?.value as { connections?: typeof current } | null)?.connections) ?? null;
  const changes = previous ? diffAccess(previous, current) : [];
  for (const change of changes) {
    const who = change.login ?? change.previousLogin ?? "unknown account";
    const text = {
      revoked: ["critical", `GitHub রিপোজিটরি অ্যাক্সেস বাতিল / Repository access lost: ${who}`],
      write_lost: ["warning", `GitHub লেখার অনুমতি চলে গেছে / Write access removed: ${who}`],
      account_changed: ["warning", `GitHub সংযোগের অ্যাকাউন্ট বদলেছে / Connected account changed: ${change.previousLogin} → ${change.login}`],
      connection_removed: ["warning", `GitHub সংযোগ সরানো হয়েছে / GitHub connection removed: ${who}`],
      restored: ["info", `GitHub রিপোজিটরি অ্যাক্সেস ফিরে এসেছে / Repository access restored: ${who}`],
    }[change.kind] as ["critical" | "warning" | "info", string];
    const { error } = await supabaseAdmin.from("system_alerts").insert({
      code: `github_access_${change.kind}`, severity: text[0], title: text[1],
      detail: JSON.stringify({ repository: WATCHED_REPOSITORY, kind: change.kind, account: change.login, previousAccount: change.previousLogin }),
      action: "IT: System পাতায় GitHub অ্যাক্সেস প্যানেল খুলে যাচাই করুন এবং প্রয়োজনে সংযোগ পুনরায় যুক্ত করুন।",
    });
    if (error) throw new Error("Access change alert could not be saved");
  }
  const next = mergeSnapshot(previous ?? [], current);
  const { error: saveError } = await supabaseAdmin.from("system_settings").upsert({ key: WATCH_KEY, value: { connections: next, checkedAt: result.checkedAt } as never }, { onConflict: "key" });
  if (saveError) throw new Error("Access watch state could not be saved");
  return { checked: current.length, alerts: changes.length, baseline: !previous };
}
