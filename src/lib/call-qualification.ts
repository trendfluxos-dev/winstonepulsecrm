import { evaluate, parseAnswers } from "./lead-evaluation";
import { fastDisqualification } from "./fast-disqualification";

export const REPORT_GRADES = ["A", "B", "C", "D"] as const;
export type ReportGrade = (typeof REPORT_GRADES)[number];
export const REPORT_GRADE_LABELS = {
  A: "Prime Buyer — High budget, ready for site visit or immediate booking",
  B: "Serious Prospect — Clear requirements, decision within 1–3 months",
  C: "Early-stage Inquiry — Exploring options, undecided budget or longer timeline",
  D: "Low Probability — Weak buying intent or low conversion probability",
} as const;

/** Authoritative for both web and device submit; previews never supply saved scores. */
export function qualifyCallReport(input: {
  category: string; connected: boolean; evaluationAnswers?: unknown;
  grade?: string | null; followUpPending: boolean;
}) {
  const rejection = fastDisqualification(input.category);
  if (rejection || !input.connected) return { rejection, answers: null, evaluation: null, grade: null };
  const answers = parseAnswers(input.evaluationAnswers);
  if (!answers) throw new Error("কল রিপোর্টের ছয়টি প্রশ্নের প্রতিটিতে হ্যাঁ / না দিন; উত্তর বাদ রাখা যাবে না।");
  const grade = REPORT_GRADES.find(value => value === input.grade);
  if (!grade) throw new Error("কল রিপোর্টে একটি Grade A / B / C / D বাছাই করুন।");
  return { rejection: null, answers, evaluation: evaluate(answers, input.followUpPending), grade };
}