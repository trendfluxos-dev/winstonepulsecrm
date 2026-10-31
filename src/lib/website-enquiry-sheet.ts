/**
 * "Website Enquiries" tab of the Daily Lead Report spreadsheet (pure rules).
 * Website enquiries are leads that arrived from winstonebd.com through the
 * signed Winstone OS bridge (source os_website / website). They get their own
 * tab so they are never mixed into the agents' call/lead report rows.
 * Rows are matched by Lead ID: known rows are refreshed, new ones appended,
 * old rows and the HQ note column are never cleared.
 */
import { safeCell } from "@/lib/report-sheet.server";

export const WEBSITE_ENQUIRY_TAB = "Website Enquiries";
export const WEBSITE_ENQUIRY_SOURCES = ["os_website", "website"] as const;

export const WEBSITE_ENQUIRY_HEADER = [
  "Received (Dhaka)",
  "Name",
  "Phone",
  "Source",
  "Project interest",
  "Budget",
  "Assignment",
  "Agent",
  "Status",
  "Synced",
  "HQ note",
  "Lead ID",
] as const;

const HQ_NOTE = 10;
const LEAD_ID = 11;

export type WebsiteEnquiryRow = {
  leadId: string;
  receivedDhaka: string;
  name: string;
  phone: string;
  source: string;
  projectInterest: string;
  budget: string;
  agentName: string;
  status: string;
};

export function isWebsiteEnquirySource(source: string | null | undefined): boolean {
  return (WEBSITE_ENQUIRY_SOURCES as readonly string[]).includes((source ?? "").trim().toLowerCase());
}

/** Reads the "Project interest:" / "Budget:" lines saved at intake. Never guesses. */
export function noteField(notes: string | null | undefined, label: string): string {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(`${label}:`));
  return line ? line.slice(label.length + 1).trim() : "";
}

export function toWebsiteEnquiryLine(row: WebsiteEnquiryRow, syncedAt: string): string[] {
  return [
    row.receivedDhaka,
    row.name,
    row.phone,
    row.source,
    row.projectInterest,
    row.budget,
    row.agentName ? "Assigned" : "Unassigned — waiting for LeadHub",
    row.agentName,
    row.status,
    syncedAt,
    "",
    row.leadId,
  ].map(safeCell);
}

/** Update rows already in the tab (keeping HQ notes), append new ones. */
export function planWebsiteEnquiryRows(existing: string[][], rows: WebsiteEnquiryRow[], syncedAt: string) {
  const positions = new Map<string, number>();
  existing.forEach((line, index) => {
    const id = line[LEAD_ID];
    if (!id) return;
    if (positions.has(id)) throw new Error("Duplicate lead IDs in Website Enquiries tab");
    positions.set(id, index);
  });
  let nextRow = existing.length + 2;
  return rows.map((row) => {
    const index = positions.get(row.leadId);
    const values = toWebsiteEnquiryLine(row, syncedAt);
    if (index !== undefined) values[HQ_NOTE] = existing[index]?.[HQ_NOTE] ?? "";
    return { rowNumber: index === undefined ? nextRow++ : index + 2, values };
  });
}
