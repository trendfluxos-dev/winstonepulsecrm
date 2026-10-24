import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Rotation happens only in the managed secret form, never through an app request. */
export const inspectMetaCredentialSafety = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().max(256).nullable() }).strict().parse(input))
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    return {
      checkedAt: new Date().toISOString(),
      configured: Boolean(process.env["META_PAGE_ACCESS_TOKEN"]),
      credentialSource: "managed_server_secret" as const,
      oldTokenRevocation: "unverified" as const,
      productionReplacement: "unverified" as const,
      connected: false as const,
    };
  });

export const inspectMetaConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().max(256).nullable() }).strict().parse(input))
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { testMetaConnection } = await import("@/lib/meta-connection-test.server");
    return testMetaConnection({ appId: process.env["META_APP_ID"], pageId: process.env["META_PAGE_ID"], pageToken: process.env["META_PAGE_ACCESS_TOKEN"], appSecret: process.env["META_APP_SECRET"] });
  });