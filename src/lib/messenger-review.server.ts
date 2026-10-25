/**
 * Turning one genuinely stored Messenger message into a CRM lead.
 *
 * Nothing here runs on demo data: the message must already exist in durable
 * storage, staff must confirm the name, phone and customer consent, and the
 * lead always enters through the canonical intake path as an unassigned lead,
 * so LeadHub Nexus stays the one place that decides who works it.
 */
import { extractBangladeshPhones } from "@/lib/lead-phone";

export type StoredMessage = {
  id: string;
  threadId: string;
  pageId: string;
  psid: string;
  direction: "inbound" | "outbound";
  body: string | null;
  leadId: string | null;
};

export type ReviewStore = {
  /** null when the row genuinely is not there; "unavailable" when storage cannot be read. */
  loadMessage(messageId: string): Promise<StoredMessage | null | "unavailable">;
  linkLead(messageId: string, leadId: string): Promise<{ ok: boolean }>;
};

export type ReviewedLeadOutcome =
  | { ok: true; leadId: string; duplicate: boolean; assignedTo: string | null }
  | { ok: false; code: "STORAGE_UNAVAILABLE" | "MESSAGE_NOT_STORED" | "NOT_INBOUND" | "ALREADY_LINKED" | "CONSENT_REQUIRED" | "PHONE_REQUIRED" | "NAME_REQUIRED" };

const refuse = (code: Extract<ReviewedLeadOutcome, { ok: false }>["code"]): ReviewedLeadOutcome => ({ ok: false, code });

/** Staff-confirmed conversion of a stored inbound message; refuses without durable evidence. */
export async function reviewMessengerMessage(
  input: {
    messageId: string;
    name: string;
    phone: string;
    consentConfirmed: boolean;
    actorProfileId?: string | null;
    actorLabel?: string | null;
  },
  deps: {
    store: ReviewStore;
    intake: (lead: {
      name: string;
      phoneNumber: string;
      notes?: string | null;
      ownerId: string | null;
      source?: string;
      actorProfileId?: string | null;
      actorLabel?: string | null;
    }) => Promise<{ leadId: string; duplicate: boolean; assignedTo: string | null }>;
  },
): Promise<ReviewedLeadOutcome> {
  if (!input.consentConfirmed) return refuse("CONSENT_REQUIRED");
  const name = input.name.trim();
  if (!name) return refuse("NAME_REQUIRED");

  const stored = await deps.store.loadMessage(input.messageId);
  if (stored === "unavailable") return refuse("STORAGE_UNAVAILABLE");
  if (!stored) return refuse("MESSAGE_NOT_STORED");
  if (stored.direction !== "inbound") return refuse("NOT_INBOUND");
  if (stored.leadId) return refuse("ALREADY_LINKED");

  // The number must be a real Bangladesh number the customer actually wrote,
  // or one the staff confirmed while reviewing — never invented here.
  const phones = extractBangladeshPhones(input.phone);
  if (phones.length === 0) return refuse("PHONE_REQUIRED");

  const result = await deps.intake({
    name,
    phoneNumber: input.phone.trim(),
    notes: `Messenger message ${input.messageId} reviewed by ${input.actorLabel?.trim() || "staff"}`,
    ownerId: null,
    source: "messenger",
    actorProfileId: input.actorProfileId ?? null,
    actorLabel: input.actorLabel?.trim() || null,
  });

  const linked = await deps.store.linkLead(input.messageId, result.leadId);
  if (!linked.ok) return refuse("STORAGE_UNAVAILABLE");

  return { ok: true, leadId: result.leadId, duplicate: result.duplicate, assignedTo: result.assignedTo };
}
