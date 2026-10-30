/**
 * Claude HQ daily briefing — pure, browser-safe rules. The facts passed to
 * Claude are aggregates only: totals, categories, hourly counts and per-agent
 * counts. Customer names, phones, lead IDs and call summaries never leave the
 * CRM through this path.
 */
import type { BriefBlock } from "@/lib/hq-brief.server";

export const CLAUDE_BRIEFING_MODEL = "anthropic/claude-sonnet-5";

export type BriefingFacts = {
  window: string;
  totals: BriefBlock["totals"];
  categories: { label: string; count: number }[];
  hourly: { hour: string; calls: number; connected: number; minutes: number }[];
  agents: { name: string; calls: number; connected: number; hot: number; warm: number; followUps: number }[];
};

export function buildBriefingFacts(block: BriefBlock): BriefingFacts {
  return {
    window: `${block.label} (${block.fromLabel}–${block.toLabel})`,
    totals: block.totals,
    categories: block.categories.map((c) => ({ label: c.label, count: c.count })),
    hourly: block.hourly.map((h) => ({ hour: h.hour, calls: h.calls, connected: h.connected, minutes: h.minutes })),
    agents: block.agents.map((a) => ({
      name: a.name,
      calls: a.calls,
      connected: a.connected,
      hot: a.hot,
      warm: a.warm,
      followUps: a.followUps,
    })),
  };
}

export const BRIEFING_SYSTEM = [
  "You write a short daily briefing for the Executive HQ of Winstone Properties, a Dhaka real-estate company.",
  "Write in Bangla. Use 4–6 short bullet points, under 140 words total.",
  "Use ONLY the numbers in the provided JSON. Never invent figures, customers, causes or targets.",
  "Cover: overall activity, connection rate, hot/warm interest, follow-ups due, standout agents and one gentle point to watch.",
  "Do not give operational instructions or assign leads; HQ only observes.",
  "If there are zero calls, say so plainly in one bullet.",
].join(" ");
