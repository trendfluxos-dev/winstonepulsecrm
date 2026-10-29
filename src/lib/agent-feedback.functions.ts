import { createServerFn } from "@tanstack/react-start";
import { FEEDBACK_END, FEEDBACK_SUBJECT, agentFeedbackSchema, feedbackWindow } from "@/lib/agent-feedback";
async function agent() {
  const { resolveCaller } = await import("@/lib/access.server");
  const me = await resolveCaller(null, { skipMaintenance: true });
  if (!me.userId || !me.profile || me.profile.role !== "agent" || me.approval !== "approved" || !me.profile.is_active) throw new Error("অনুমোদিত এজেন্ট অ্যাকাউন্ট দিয়ে লগইন করুন");
  return me.profile;
}
export const getAgentFeedbackStatus = createServerFn({ method: "GET" }).handler(async () => {
  const me = await agent();
  const { feedbackRequired } = await import("@/lib/agent-feedback.server");
  return { required: await feedbackRequired(me.id), expiresAt: FEEDBACK_END };
});
export const submitAgentFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => agentFeedbackSchema.parse(input))
  .handler(async ({ data }) => {
    const me = await agent();
    if (!feedbackWindow()) throw new Error("আজকের মতামত জমার সময় শেষ হয়েছে — সকাল ৯:৩০ ঢাকা");
    const { feedbackRequired } = await import("@/lib/agent-feedback.server");
    if (await feedbackRequired(me.id)) {
      const { createSupportTicket } = await import("@/lib/team-support.server");
      await createSupportTicket({ agentProfileId: me.id, agentName: me.name, agentRole: me.role,
        category: "crm_problem", subject: FEEDBACK_SUBJECT,
        message: `সমস্যা/বর্তমান অবস্থা:\n${data.problem}\n\nকাজে প্রভাব:\n${data.impact}\n\nপ্রয়োজনীয় পরিবর্তন:\n${data.improvement}`,
        priority: "normal", platform: "web" });
    }
    return { required: false, expiresAt: FEEDBACK_END };
  });