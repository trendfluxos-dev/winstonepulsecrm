/**
 * Agent WhatsApp alerts — shared pure rules (browser + server safe).
 *
 * Alerts go only to the agent's own opted-in number, use Meta-approved
 * templates, and carry counts only — never customer names or phone numbers.
 */

export const AGENT_WA_TEMPLATES = {
  newLeads: "agent_new_leads_alert",
  dailyProgress: "agent_daily_progress",
} as const;
export const AGENT_WA_LANGUAGE = "bn";
export const AGENT_WA_SETTING_KEY = "agent_whatsapp_alerts_enabled";

export type AgentAlertKind = "new_leads" | "daily_progress" | "test";
export type AgentAlertStatus = "sending" | "accepted" | "sent" | "delivered" | "read" | "failed";

/** Bangladesh mobile → WhatsApp digits (8801XXXXXXXXX), or null when not a BD mobile. */
export function normalizeAgentWhatsApp(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits;
  if (/^01[3-9]\d{8}$/.test(digits)) return `88${digits}`;
  if (/^1[3-9]\d{8}$/.test(digits)) return `880${digits}`;
  return null;
}

/** Shows 8801712345678 as 01712-345678 for staff screens. */
export function displayAgentWhatsApp(digits: string | null): string {
  if (!digits || !/^8801\d{9}$/.test(digits)) return digits ?? "";
  const local = `0${digits.slice(3)}`;
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}

const OPT_OUT = new Set(["stop", "unsubscribe", "বন্ধ", "বন্ধ করুন", "stop alerts"]);
export function isOptOutText(text: string | null | undefined): boolean {
  return OPT_OUT.has((text ?? "").trim().toLowerCase().replace(/[.!।]+$/u, ""));
}

/** New leads since the last alert; never negative, null when the total is unknown. */
export function newLeadsSinceLastAlert(totalToday: number | null, lastAlertedTotal: number): number | null {
  if (totalToday == null) return null;
  return Math.max(0, totalToday - lastAlertedTotal);
}

export function newLeadsParams(name: string, count: number): string[] {
  return [name, String(count)];
}

export function dailyProgressParams(input: {
  name: string; dayLabel: string; received: number; quota: number; reports: number; followUps: number;
}): string[] {
  return [input.name, input.dayLabel, String(input.received), String(input.quota), String(input.reports), String(input.followUps)];
}

const RANK: Record<string, number> = { sending: 0, accepted: 1, sent: 2, delivered: 3, read: 4 };

/**
 * Next stored status after a Meta callback. Delivery only moves forward; a
 * late "sent" never undoes "delivered"/"read", and "failed" cannot override a
 * message that was already delivered or read.
 */
export function nextAlertStatus(current: AgentAlertStatus, incoming: string): AgentAlertStatus {
  const next = incoming.toLowerCase();
  if (next === "failed") return (RANK[current] ?? 0) >= RANK.delivered ? current : "failed";
  if (!(next in RANK)) return current;
  if (current === "failed") return current;
  return (RANK[next] ?? 0) > (RANK[current] ?? 0) ? (next as AgentAlertStatus) : current;
}

/** Dhaka clock reading used to decide whether the new-lead alert window is open. */
export function inNewLeadWindow(now: Date): boolean {
  const dhaka = new Date(now.getTime() + 6 * 3600_000);
  const minutes = dhaka.getUTCHours() * 60 + dhaka.getUTCMinutes();
  return minutes >= 9 * 60 && minutes <= 17 * 60 + 35;
}
