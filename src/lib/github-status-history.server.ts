import { githubHistoryEntry, githubCheckErrorCode } from "@/lib/github-status-shared";
import { readGithubStatus } from "@/lib/github-status.server";
import type { z } from "zod";
const ACTION = "github_repository_status_checked";
async function record(entry: z.infer<typeof githubHistoryEntry>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      action: ACTION, entity_type: "github_repository", actor_label: "IT Console",
      metadata: githubHistoryEntry.parse(entry) as never,
    });
    if (error) throw new Error("History write failed");
    return true;
  } catch { return false; }
}
export async function checkGithubWithHistory(repository: string, branch: string | undefined) {
  const checkedAt = new Date().toISOString();
  let result: Awaited<ReturnType<typeof readGithubStatus>>;
  try { result = await readGithubStatus(repository, branch); }
  catch (error) {
    const errorCode = githubCheckErrorCode(error);
    const recorded = await record({ repository, requestedBranch: branch ?? null, branch: null,
      checkedAt, outcome: "failed", private: null, sha: null, canRead: null, canWrite: null,
      protected: null, runs: [], errorCode });
    throw new Error(`GitHub check failed (${errorCode}). ${recorded ? "Saved in check history." : "History could not be saved."}`);
  }
  const historyRecorded = await record({ repository, requestedBranch: branch ?? null, branch: result.branch,
    checkedAt: result.checkedAt, outcome: "success", private: result.private, sha: result.sha,
    canRead: result.canRead, canWrite: result.canWrite, protected: result.protected, runs: result.runs, errorCode: null });
  return { ...result, historyRecorded };
}
export async function readGithubCheckHistory(repository: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("audit_logs").select("id, created_at, metadata")
    .eq("action", ACTION).contains("metadata", { repository }).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Repository check history unavailable");
  return (data ?? []).map(row => {
    const parsed = githubHistoryEntry.safeParse(row.metadata);
    return parsed.success ? { id: row.id, ...parsed.data } : null;
  }).filter((row): row is NonNullable<typeof row> => row !== null);
}