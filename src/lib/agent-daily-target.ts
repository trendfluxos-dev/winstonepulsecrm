import { MAX_DAILY_LEADS_PER_AGENT } from "@/lib/lead-quota";
export function validDailyTarget(target: number) {
  return Number.isInteger(target) && target >= 1 && target <= MAX_DAILY_LEADS_PER_AGENT;
}
export function allocationProgress(received: number, target = MAX_DAILY_LEADS_PER_AGENT) {
  if (!validDailyTarget(target)) throw new Error("Daily target must be 1–50");
  return Math.min(100, Math.round(Math.max(0, received) / target * 100));
}