import { describe, expect, it } from "vitest";
import { CRM_TOURS, INITIAL_TOUR_PROGRESS, advanceTour, previousTour, restoreTourProgress } from "@/lib/crm-walkthrough";

describe("walkthrough reading progress", () => {
  it("rejects invalid saved progress and unknown completion identifiers", () => {
    expect(restoreTourProgress({ workspace: "admin", step: Infinity, completed: ["made-up", "daily-work", "daily-work"] })).toEqual({ workspace: "agent", step: 0, completed: ["daily-work"] });
    expect(restoreTourProgress(null)).toEqual(INITIAL_TOUR_PROGRESS);
  });
  it("bounds saved step to the selected workspace", () => {
    expect(restoreTourProgress({ workspace: "hq", step: 999 }).step).toBe(2);
    expect(restoreTourProgress({ workspace: "hq", step: -4 }).step).toBe(0);
  });
  it("advances between workspace chapters and retains completed reading", () => {
    const next = advanceTour({ workspace: "agent", step: 3, completed: [] });
    expect(next).toEqual({ workspace: "leadhub", step: 0, completed: ["sales-tools"] });
    expect(previousTour(next)).toEqual({ workspace: "agent", step: 3, completed: ["sales-tools"] });
  });
  it("can finish every step without duplicate completions or running out of bounds", () => {
    let state = { ...INITIAL_TOUR_PROGRESS, completed: [] as string[] };
    const total = CRM_TOURS.reduce((sum, tour) => sum + tour.steps.length, 0);
    for (let i = 0; i < total; i++) state = advanceTour(state);
    expect(state.completed.length).toBe(total);
    expect(state.workspace).toBe("it");
    expect(state.step).toBe(3);
    expect(advanceTour(state)).toEqual(state);
    expect(previousTour(INITIAL_TOUR_PROGRESS)).toEqual(INITIAL_TOUR_PROGRESS);
  });
});