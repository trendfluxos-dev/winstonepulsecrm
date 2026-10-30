import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenInput = z.object({ adminToken: z.string().max(256).nullable() }).strict();

export const listSearchConsoleProperties = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken) !== "full") throw new Error("Full IT PIN required");
    const { listVerifiedProperties } = await import("@/lib/search-console.server");
    return listVerifiedProperties();
  });

export const getSearchConsolePerformance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenInput.extend({ siteUrl: z.string().min(3).max(300) }).strict().parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken) !== "full") throw new Error("Full IT PIN required");
    const { readSearchPerformance } = await import("@/lib/search-console.server");
    return readSearchPerformance(data.siteUrl);
  });
