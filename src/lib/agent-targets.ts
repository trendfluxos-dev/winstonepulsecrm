import { MAX_DAILY_LEADS_PER_AGENT } from "@/lib/lead-quota";

/** Per-agent daily lead target: whole number 1..50; unset agents use 50. */
export function parseAgentTargets(raw: unknown): Record<string, number> {
  const src = raw && typeof raw === "object" ? (raw as { targets?: unknown }).targets : null;
  const out: Record<string, number> = {};
  if (!src || typeof src !== "object") return out;
  for (const [id, value] of Object.entries(src as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_DAILY_LEADS_PER_AGENT) out[id] = value;
  }
  return out;
}

export function targetFor(targets: Record<string, number>, agentId: string): number {
  return targets[agentId] ?? MAX_DAILY_LEADS_PER_AGENT;
}

/** Completion % capped at 100. */
export function fillPercent(received: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((received / target) * 100));
}
