import { createServerFn } from "@tanstack/react-start";
import { githubCheckInput } from "@/lib/github-status-shared";

export const getGithubRepositoryStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => githubCheckInput.parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken) !== "full") throw new Error("Full IT PIN required");
    const { checkGithubWithHistory } = await import("@/lib/github-status-history.server");
    return checkGithubWithHistory(data.repository, data.branch);
  });

export const getGithubCheckHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => githubCheckInput.omit({ branch: true }).parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken) !== "full") throw new Error("Full IT PIN required");
    const { readGithubCheckHistory } = await import("@/lib/github-status-history.server");
    return readGithubCheckHistory(data.repository);
  });
export const getGithubActivity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => githubCheckInput.omit({ branch: true }).parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken) !== "full") throw new Error("Full IT PIN required");
    const { readGithubActivity } = await import("@/lib/github-status.server");
    return readGithubActivity(data.repository);
  });

export const getAndroidBuilds = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => githubCheckInput.omit({ branch: true }).parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken) !== "full") throw new Error("Full IT PIN required");
    const { readAndroidBuilds } = await import("@/lib/github-status.server");
    return readAndroidBuilds(data.repository);
  });

export const getGithubAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => githubCheckInput.omit({ branch: true }).parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken) !== "full") throw new Error("Full IT PIN required");
    const { readGithubAccess } = await import("@/lib/github-access.server");
    return readGithubAccess(data.repository);
  });
