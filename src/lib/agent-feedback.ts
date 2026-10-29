import { z } from "zod";
export const FEEDBACK_START = "2026-10-29T02:48:00.000Z";
export const FEEDBACK_END = "2026-10-29T03:30:00.000Z";
export const FEEDBACK_SUBJECT = "System feedback · 2026-10-29 morning";
export const agentFeedbackSchema = z.object({
  problem: z.string().trim().min(20, "সমস্যা বা সমস্যা না থাকার অবস্থা অন্তত ২০ অক্ষরে লিখুন").max(1500),
  impact: z.string().trim().min(10, "কাজে কী প্রভাব পড়ছে অন্তত ১০ অক্ষরে লিখুন").max(800),
  improvement: z.string().trim().min(10, "কী পরিবর্তন চান অন্তত ১০ অক্ষরে লিখুন").max(1000),
}).strict();
export function feedbackWindow(now = Date.now()) {
  return now >= Date.parse(FEEDBACK_START) && now < Date.parse(FEEDBACK_END);
}