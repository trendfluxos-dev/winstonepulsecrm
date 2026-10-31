import { describe, expect, it } from "vitest";
import {
  isWebsiteEnquirySource,
  noteField,
  planWebsiteEnquiryRows,
  WEBSITE_ENQUIRY_HEADER,
  WEBSITE_ENQUIRY_TAB,
  type WebsiteEnquiryRow,
} from "@/lib/website-enquiry-sheet";

const row = (leadId: string, extra: Partial<WebsiteEnquiryRow> = {}): WebsiteEnquiryRow => ({
  leadId, receivedDhaka: "31/10/2026, 13:00", name: "Rahim", phone: "01711111111", source: "os_website",
  projectInterest: "", budget: "", agentName: "", status: "pending", ...extra,
});

describe("Website Enquiries tab", () => {
  it("is its own tab, separate from the dated call/lead tabs", () => {
    expect(WEBSITE_ENQUIRY_TAB).toBe("Website Enquiries");
    expect(WEBSITE_ENQUIRY_TAB).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("only website sources count as website enquiries", () => {
    expect(isWebsiteEnquirySource("os_website")).toBe(true);
    expect(isWebsiteEnquirySource("website")).toBe(true);
    expect(isWebsiteEnquirySource("webhook")).toBe(false);
    expect(isWebsiteEnquirySource("manual")).toBe(false);
    expect(isWebsiteEnquirySource(null)).toBe(false);
  });

  it("appends new enquiries below existing rows and keeps the HQ note on known rows", () => {
    const existing = [
      ["30/10/2026, 10:00", "Old", "01700000000", "os_website", "", "", "Unassigned — waiting for LeadHub", "", "pending", "x", "HQ called back", "lead-a"],
    ];
    const plan = planWebsiteEnquiryRows(existing, [row("lead-a", { agentName: "Karim" }), row("lead-b")], "now");
    expect(plan.map((p) => p.rowNumber)).toEqual([2, 3]);
    expect(plan[0]!.values[10]).toBe("HQ called back");
    expect(plan[0]!.values[6]).toBe("Assigned");
    expect(plan[1]!.values[6]).toBe("Unassigned — waiting for LeadHub");
    expect(plan[1]!.values[WEBSITE_ENQUIRY_HEADER.length - 1]).toBe("lead-b");
  });

  it("never plans to clear rows that are no longer returned", () => {
    const existing = [["", "", "", "", "", "", "", "", "", "", "", "lead-old"]];
    const plan = planWebsiteEnquiryRows(existing, [row("lead-new")], "now");
    expect(plan).toHaveLength(1);
    expect(plan[0]!.rowNumber).toBe(3);
  });

  it("neutralises formula-looking text from the website form", () => {
    const [p] = planWebsiteEnquiryRows([], [row("lead-x", { name: "=HYPERLINK(\"x\")" })], "now");
    expect(p!.values[1]).toBe("'=HYPERLINK(\"x\")");
  });

  it("reads project and budget only from the saved intake lines", () => {
    const notes = "Winstone OS lead 42\nProject interest: Winstone Heights\nBudget: 1-2 crore";
    expect(noteField(notes, "Project interest")).toBe("Winstone Heights");
    expect(noteField(notes, "Budget")).toBe("1-2 crore");
    expect(noteField("nothing here", "Budget")).toBe("");
  });
});
