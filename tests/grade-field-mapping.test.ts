import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { qualifyCallReport, REPORT_GRADES } from "@/lib/call-qualification";

const read = (p: string) => readFileSync(p, "utf8");

/**
 * Regression for the reported failure: the form said "Grade pending — set by AI
 * analysis or HQ" (no selector) while the database demanded a grade on every
 * connected report. Web, Android and server must use one `grade` field.
 */
describe("grade field mapping: web form, phone app and server agree", () => {
  const form = read("src/components/crm/PostCallReportGate.tsx");
  const fns = read("src/lib/call-reports.functions.ts");
  const server = read("src/lib/call-reports.server.ts");
  const route = read("src/routes/api/public/agent/report.ts");
  const live = read("android/app/src/main/java/com/winstone/connect/ui/LiveCallScreen.kt");
  const api = read("android/app/src/main/java/com/winstone/connect/data/remote/WinstoneApi.kt");
  const db = read("drizzle/migrations/0138_unified_call_qualification_triggers.sql");

  it("the old no-selector 'Grade pending' form state is gone", () => {
    expect(form).not.toMatch(/Grade pending/);
    expect(form).toMatch(/<GradePicker value=\{grade\} onChange=\{setGrade\} \/>/);
  });

  it("web submits the selected grade under `grade`, only for qualifying sales calls", () => {
    expect(form).toMatch(/grade: qualifying \? \(REPORT_GRADES\.find\(value => value === grade\) \?\? null\) : null/);
    expect(fns).toMatch(/grade: z\.enum\(\["A", "B", "C", "D"\]\)\.nullable\(\)\.optional\(\)/);
    expect(fns).toMatch(/grade: data\.grade \?\? null/);
  });

  it("phone app sends `grade`, shows A/B/C/D and an inline missing-grade message", () => {
    expect(api).toContain('grade?.let { put("grade", it) }');
    expect(live).toMatch(/listOf\("A", "B", "C", "D"\)/);
    expect(live).toContain("গ্রেড বাকি");
    expect(route).toMatch(/grade: body\.grade \?\? null/);
  });

  it("submit path uses the shared validator and never allows a pending grade", () => {
    const submit = server.slice(server.indexOf("export async function submitCallReport"), server.indexOf("export async function loadPendingReportDetail"));
    expect(submit).toMatch(/qualifyCallReport\(/);
    expect(submit).not.toMatch(/allowPendingGrade: true/);
  });

  it("database requires the same A/B/C/D grade only for connected non-rejection reports", () => {
    expect(db).toMatch(/NEW\.grade NOT IN \('A','B','C','D'\)/);
    expect(db).toMatch(/IF NEW\.category IN \('not_interested','wrong_number'\) THEN[\s\S]*NEW\.grade := NULL/);
    expect([...REPORT_GRADES]).toEqual(["A", "B", "C", "D"]);
  });

  it("server accepts a selected grade and rejects a missing one", () => {
    const answers = { project_interest: true, asked_price: false, wanted_info: true, visit_interest: false, decision_30d: true, wants_follow_up: false };
    const base = { category: "interested", connected: true, evaluationAnswers: answers, followUpPending: false };
    expect(qualifyCallReport({ ...base, grade: "C" })).toMatchObject({ grade: "C", evaluation: { score: 45, category: "warm" } });
    expect(() => qualifyCallReport({ ...base, grade: null })).toThrow("Grade");
    for (const category of ["not_interested", "wrong_number", "fake"])
      expect(qualifyCallReport({ ...base, category, grade: null, evaluationAnswers: null })).toMatchObject({ grade: null, answers: null, evaluation: null });
  });
});
