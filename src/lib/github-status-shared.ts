import { z } from "zod";
export const githubCheckInput = z.object({
  adminToken: z.string().max(256).nullable(),
  repository: z.string().trim().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).max(200),
  branch: z.string().trim().min(1).max(200).optional(),
}).strict();
export const githubHistoryEntry = z.object({
  repository: z.string(), requestedBranch: z.string().nullable(), branch: z.string().nullable(),
  checkedAt: z.string(), outcome: z.enum(["success", "failed"]),
  private: z.boolean().nullable(), sha: z.string().nullable(),
  canRead: z.boolean().nullable(), canWrite: z.boolean().nullable(), protected: z.boolean().nullable(),
  errorCode: z.string().nullable(),
  runs: z.array(z.object({ id: z.number(), name: z.string(), status: z.string(), conclusion: z.string().nullable(), updatedAt: z.string() })).max(5),
});
export function githubCheckErrorCode(error: unknown) {
  const text = error instanceof Error ? error.message : "";
  const status = /HTTP (\d{3})/.exec(text)?.[1];
  return status ? `HTTP_${status}` : text === "GitHub connection is not configured" ? "CONNECTION_NOT_CONFIGURED" : "READ_FAILED";
}