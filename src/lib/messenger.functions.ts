import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { NOT_CONNECTED, messengerView } from "@/lib/messenger-shared";

const Base = z.object({ adminToken: z.string().nullable().optional() });

/** Read-only saved message → linked lead; disconnected paths never read customer rows. */
export const getMessengerLeadDetails = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ messageId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (!messengerView(caller).canOpen) return { ok: false as const, code: "UNAVAILABLE" as const };
    const { getMessengerService } = await import("@/lib/messenger.server");
    const connection = await getMessengerService().connection();
    if (!connection.connected) return { ok: false as const, code: "DISCONNECTED" as const };
    const { readMessengerLinkedLead, messengerLeadDetailStore } = await import("@/lib/messenger-lead-details.server");
    try {
      return await readMessengerLinkedLead(caller, connection.connected, data.messageId, await messengerLeadDetailStore());
    } catch { return { ok: false as const, code: "UNAVAILABLE" as const }; }
  });

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

/**
 * Guarded reply: the role is re-checked, then the reply gate must clear every
 * blocker (secrets stored, all four Meta tracks verified, audited sync enable,
 * explicit staff confirmation) before anything is queued or sent. Until then
 * it refuses with a safe blocker list — nothing is sent or stored.
 */
export const sendMessengerReply = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      threadId: z.string().uuid(),
      leadId: z.string().uuid().nullable().optional(),
      text: z.string().min(1).max(2000),
      requestId: z.string().uuid(),
      staffConfirmed: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (!messengerView(caller).canReply) return { ok: false as const, reason: "FORBIDDEN" as const };
    const { guardedSendReply, supabaseReplyStore } = await import("@/lib/messenger-reply.server");
    return guardedSendReply(
      {
        threadId: data.threadId,
        leadId: data.leadId ?? null,
        text: data.text,
        requestId: data.requestId,
        staffConfirmed: data.staffConfirmed,
        actor: { scope: caller.scope, readOnly: caller.readOnly, userId: caller.userId, profileId: caller.profile?.id ?? null },
      },
      { env: process.env, store: supabaseReplyStore() },
    );
  });

/**
 * Staff-confirmed conversion of one genuinely stored message into an unassigned
 * lead. The role is re-checked server-side, the message must exist in durable
 * storage, and while Facebook is not connected the call always refuses — demo
 * rows can never become CRM records.
 */
export const reviewMessengerLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      messageId: z.string().min(1).max(200),
      name: z.string().min(1).max(200),
      phone: z.string().min(1).max(60),
      consentConfirmed: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    const view = messengerView(caller);
    if (!view.canOpen || view.readOnly) return { ok: false as const, code: "FORBIDDEN" as const };
    if (caller.scope === "agent") {
      const { assertBriefingForCaller } = await import("@/lib/agent-briefing.server");
      await assertBriefingForCaller(caller);
    }

    const { getMessengerService } = await import("@/lib/messenger.server");
    const connection = await getMessengerService().connection();
    if (!connection.connected) return { ok: false as const, code: "FACEBOOK_NOT_CONNECTED" as const };

    const { reviewMessengerMessage } = await import("@/lib/messenger-review.server");
    const { supabaseMessengerReviewStore } = await import("@/lib/messenger-store.server");
    const { intakeLead } = await import("@/lib/lead-intake.server");
    return reviewMessengerMessage(
      {
        messageId: data.messageId,
        name: data.name,
        phone: data.phone,
        consentConfirmed: data.consentConfirmed,
        actorProfileId: caller.profile?.id ?? null,
        actorLabel: caller.profile?.name ?? caller.label ?? null,
      },
      { store: supabaseMessengerReviewStore(), intake: intakeLead },
    );
  });
