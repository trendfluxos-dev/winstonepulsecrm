import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const listDistributionFailures = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { readDistributionFailures } = await import("@/lib/distribution-failure.server");
    return readDistributionFailures();
  });