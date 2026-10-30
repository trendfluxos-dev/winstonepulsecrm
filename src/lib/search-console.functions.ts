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
  .inputValidator((input: unknown) => tokenInput.extend({ siteUrl: z.string().min(3).max(300), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict().parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken) !== "full") throw new Error("Full IT PIN required");
    const { readSearchPerformance } = await import("@/lib/search-console.server");
    if (!data.startDate !== !data.endDate) throw new Error("Choose both a start and an end date");
    return readSearchPerformance(data.siteUrl, data.startDate && data.endDate ? { startDate: data.startDate, endDate: data.endDate } : undefined);
  });
