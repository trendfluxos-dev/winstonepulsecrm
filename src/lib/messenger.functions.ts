import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { NOT_CONNECTED, messengerView } from "@/lib/messenger-shared";

const Base = z.object({ adminToken: z.string().nullable().optional() });

/** Role view + connection state. Uses the existing caller check; reads no Messenger data. */
export const getMessengerStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    const { getMessengerService } = await import("@/lib/messenger.server");
    const connection = await getMessengerService().connection();
    return { view: messengerView(caller), connected: connection.connected, notice: NOT_CONNECTED };
  });

/** Reply placeholder: the role is re-checked, then it always refuses — nothing is sent or stored. */
export const sendMessengerReply = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({ threadId: z.string().min(1).max(100), text: z.string().min(1).max(2000), requestId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (!messengerView(caller).canReply) return { ok: false as const, reason: "FORBIDDEN" as const };
    const { getMessengerService } = await import("@/lib/messenger.server");
    return getMessengerService().sendReply(data);
  });
