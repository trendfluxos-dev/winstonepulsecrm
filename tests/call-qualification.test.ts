import { describe, expect, it } from "vitest";
import { qualifyCallReport } from "@/lib/call-qualification";
import { EVALUATION_QUESTIONS, categoryForScore } from "@/lib/lead-evaluation";
const answers = (value: boolean) => Object.fromEntries(EVALUATION_QUESTIONS.map(q => [q.key, value]));
const base = { category: "interested", connected: true, grade: "B", followUpPending: false };
describe("unified report qualification", () => {
  it("six Yes answers yield exactly 90 and HOT", () => {
    expect(qualifyCallReport({ ...base, evaluationAnswers: answers(true) }).evaluation).toMatchObject({ score: 90, category: "hot" });
  });
  it("six No answers yield exactly zero and COLD", () => {
    expect(qualifyCallReport({ ...base, evaluationAnswers: answers(false) }).evaluation).toMatchObject({ score: 0, category: "cold" });
  });
  for (const [score, category] of [[20,"cold"],[21,"warm"],[50,"warm"],[51,"hot"]] as const)
    it(`${score} is ${category}`, () => expect(categoryForScore(score)).toBe(category));
  for (const q of EVALUATION_QUESTIONS) it(`missing ${q.key} is never No`, () => {
    const incomplete = answers(false); delete incomplete[q.key];
    expect(() => qualifyCallReport({ ...base, evaluationAnswers: incomplete })).toThrow("ছয়টি");
    expect(() => qualifyCallReport({ ...base, evaluationAnswers: { ...answers(false), [q.key]: null } })).toThrow("ছয়টি");
  });
  for (const grade of [null, "", "F"]) it(`invalid grade ${grade} blocks submit`, () => {
    expect(() => qualifyCallReport({ ...base, grade, evaluationAnswers: answers(true) })).toThrow("Grade");
  });
  it("manual D on HOT remains D, never temperature-derived", () => {
    expect(qualifyCallReport({ ...base, grade: "D", evaluationAnswers: answers(true) })).toMatchObject({ grade: "D", evaluation: { category: "hot" } });
  });
  for (const category of ["not_interested","wrong_number","fake"]) for (const connected of [true,false])
    it(`${category}/${connected} needs no answers/grade and generates no classification`, () => {
      expect(qualifyCallReport({ ...base, category, connected, grade: null })).toMatchObject({ answers: null, evaluation: null, grade: null });
    });
  it("callback retains qualification and follow-up priority", () => {
    expect(qualifyCallReport({ ...base, category: "callback", followUpPending: true, evaluationAnswers: answers(true) }).evaluation?.priority).toBe("high");
  });
});