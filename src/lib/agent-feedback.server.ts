import { FEEDBACK_SUBJECT, feedbackWindow } from "@/lib/agent-feedback";
export async function feedbackRequired(agentId: string, now = Date.now()) {
  if (!feedbackWindow(now)) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("team_support_tickets").select("id")
    .eq("agent_profile_id", agentId).eq("subject", FEEDBACK_SUBJECT).limit(1).maybeSingle();
  if (error) throw new Error("সিস্টেম মতামতের অবস্থা যাচাই করা যায়নি");
  return !data;
}