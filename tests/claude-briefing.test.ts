import { describe, expect, it } from "vitest";
import { buildBriefingFacts } from "@/lib/claude-briefing";

const block = {
  label: "Morning", live: true, fromLabel: "9:00", toLabel: "12:45",
  totals: { agentsWorking: 1, calls: 3, connected: 2, talkSeconds: 300, talkLabel: "5 মি", hot: 1, warm: 0, cold: 1, followUps: 1, conversations: 2 },
  hourly: [{ hour: "10", calls: 3, connected: 2, minutes: 5 }],
  categories: [{ label: "HOT LEAD", count: 1 }],
  agents: [{ agentId: "a1", name: "Rahim", employeeId: "E1", calls: 3, connected: 2, talkSeconds: 300, talkLabel: "", hot: 1, warm: 0, cold: 1, followUps: 1, categories: [], bestCategory: null,
    calls_detail: [{ id: "c1", agentName: "Rahim", leadName: "Secret Customer", phone: "01711000000", summary: "private note" }] }],
  leads: [{ leadId: "l1", name: "Secret Customer", phone: "01711000000", summary: "private note" }],
  narrative: [],
} as never;

describe("Claude HQ briefing facts", () => {
  it("never includes customer names, phones or call summaries", () => {
    const json = JSON.stringify(buildBriefingFacts(block));
    expect(json).not.toContain("Secret Customer");
    expect(json).not.toContain("01711000000");
    expect(json).not.toContain("private note");
    expect(json).not.toContain("a1");
  });
  it("keeps the floor totals unchanged", () => {
    expect(buildBriefingFacts(block).totals.calls).toBe(3);
  });
});
