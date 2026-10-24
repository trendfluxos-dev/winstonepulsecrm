import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { WindsorReportRequest, canInspectWindsorConfiguration, disconnectedWindsorReport } from "@/lib/windsor-reporting";

/** Manual IT-only preparation check; no DB, provider, storage or sync. */
export const inspectWindsorReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    adminToken: z.string().max(256).nullable(), report: WindsorReportRequest,
  }).strict().parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (!canInspectWindsorConfiguration(adminTokenScope(data.adminToken))) throw new Error("Full IT PIN required");
    // Presence only, after authorization. Never pass or log the secret.
    const configured = Boolean(process.env["WINDSOR_AI_API_KEY"]);
    return disconnectedWindsorReport(configured);
  });