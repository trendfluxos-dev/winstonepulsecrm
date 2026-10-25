import { safeDistributionReason, parseFailureDetail, type DistributionStage } from "@/lib/distribution-failure";

export async function recordDistributionFailure(error: unknown, stage: DistributionStage) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const reason = safeDistributionReason(error);
  const result = await supabaseAdmin.from("system_alerts").insert({
    code: "lead_distribution_failed", severity: "critical",
    title: "স্বয়ংক্রিয় লিড বণ্টন ব্যর্থ / Automatic lead distribution failed",
    detail: JSON.stringify({ reason, stage }),
    action: "IT যাচাই করুন; পুনরায় বণ্টন শুধু LeadHub-এর অনুমোদিত পথে।",
  });
  if (result.error) throw new Error("Distribution failure alert could not be saved");
  return reason;
}

export async function readDistributionFailures() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin.from("system_alerts")
    .select("id, created_at, detail").eq("code", "lead_distribution_failed")
    .order("created_at", { ascending: false }).limit(10);
  if (result.error) throw new Error("Distribution failure history unavailable");
  return (result.data ?? []).map(row => ({ id: row.id, createdAt: row.created_at, ...parseFailureDetail(row.detail) }));
}