import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getDailyAllocation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    surface: z.enum(["hq", "leadhub", "self"]),
    adminToken: z.string().nullable().optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const access = await import("@/lib/access.server");
    let agentId: string | undefined;
    if (data.surface === "leadhub") {
      await access.requireLeadHub(data.adminToken);
    } else if (data.surface === "hq") {
      access.requireAuthority(await access.resolveCaller(data.adminToken ?? null));
    } else {
      // PINs never choose or impersonate the agent whose own history is read.
      const caller = await access.resolveWorkCaller(null);
      if (caller.scope !== "agent" || !caller.profile) throw new Error("Agent access required");
      agentId = caller.profile.id;
    }
    const { readDailyAllocation } = await import("@/lib/daily-allocation.server");
    return readDailyAllocation(agentId);
  });