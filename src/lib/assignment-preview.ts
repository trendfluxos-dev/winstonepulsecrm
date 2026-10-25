import { extractBangladeshPhones } from "@/lib/lead-phone";
export type PreviewLead = { id: string; name: string; phone_number: string | null; created_at: string };
export function eligibleRoster(row: { role: string | null; is_active: boolean; approval_status: string | null }) {
  return row.role === "agent" && row.is_active && row.approval_status === "approved";
}
/** Side-effect-free oldest-first selection, rejecting any shared canonical phone key. */
export function selectAssignmentCandidates(rows: PreviewLead[], eligibleIds: Set<string>, takenKeys: Set<string>, limit: number) {
  const seen = new Set(takenKeys); const selected: PreviewLead[] = [];
  for (const row of [...rows].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) {
    if (selected.length >= Math.max(0, limit)) break;
    const keys = extractBangladeshPhones(row.phone_number ?? "");
    if (!eligibleIds.has(row.id) || !keys.length || keys.some(key => seen.has(key))) continue;
    keys.forEach(key => seen.add(key)); selected.push(row);
  }
  return selected;
}
export function assertPreviewUnchanged(reviewed: string[], current: string[]) {
  if (reviewed.length !== current.length || reviewed.some((id, index) => id !== current[index])) {
    throw new Error("লিড/যোগ্যতা বদলেছে — আবার প্রিভিউ দেখে নিশ্চিত করুন। Leads or eligibility changed; review a new preview.");
  }
}