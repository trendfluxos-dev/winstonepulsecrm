import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getGithubRepositoryStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    adminToken: z.string().max(256).nullable(),
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).max(200),
    branch: z.string().trim().min(1).max(200).optional(),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken) !== "full") throw new Error("Full IT PIN required");
    const { readGithubStatus } = await import("@/lib/github-status.server");
    return readGithubStatus(data.repository, data.branch);
  });