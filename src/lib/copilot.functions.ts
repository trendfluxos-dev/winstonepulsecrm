import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  adminToken: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30),
});

/** Whether this PIN session may use the copilot (IT Console "full" scope only). Used to hide the button elsewhere. */
export const copilotAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    return { allowed: Boolean(data.adminToken) && adminTokenScope(data.adminToken) === "full" };
  });

/** One turn of the Winstone AI Copilot. IT Console ("full") PIN only; HQ's read-only PIN is rejected. Read-only: it never assigns leads. */
export const askCopilot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { runCopilot } = await import("@/lib/copilot.server");
    return runCopilot(data.messages);
  });
