import { expect, it } from "vitest";
import { reviewMessengerMessage, type ReviewStore, type StoredMessage } from "@/lib/messenger-review.server";

const stored: StoredMessage = {
  id: "message-1",
  threadId: "thread-1",
  pageId: "1381455345040362",
  psid: "9007199254740991",
  direction: "inbound",
  body: "আমার ফোন 01712345678, ব্রোশিওর দিবেন?",
  leadId: null,
};

function store(overrides: Partial<ReviewStore> = {}): ReviewStore & { linked: string[] } {
  const linked: string[] = [];
  return {
    linked,
    loadMessage: async (id) => (id === stored.id ? stored : null),
    linkLead: async (messageId, leadId) => {
      linked.push(`${messageId}:${leadId}`);
      return { ok: true };
    },
    ...overrides,
  };
}

const intakeCalls: { name: string; phone: string; ownerId: string | null; source?: string }[] = [];
const intake = async (lead: { name: string; phoneNumber: string; ownerId: string | null; source?: string }) => {
  intakeCalls.push({ name: lead.name, phone: lead.phoneNumber, ownerId: lead.ownerId, source: lead.source });
  return { leadId: "lead-1", duplicate: false, assignedTo: null };
};

it("creates the lead unassigned through canonical intake with messenger source", async () => {
  intakeCalls.length = 0;
  const result = await reviewMessengerMessage(
    { messageId: stored.id, name: "রহিম উদ্দিন", phone: "01712345678", consentConfirmed: true, actorLabel: "IT" },
    { store: store(), intake },
  );
  expect(result).toEqual({ ok: true, leadId: "lead-1", duplicate: false, assignedTo: null });
  expect(intakeCalls).toHaveLength(1);
  expect(intakeCalls[0].ownerId).toBeNull();
  expect(intakeCalls[0].source).toBe("messenger");
});

it("refuses when staff has not confirmed customer consent", async () => {
  intakeCalls.length = 0;
  const result = await reviewMessengerMessage(
    { messageId: stored.id, name: "রহিম", phone: "01712345678", consentConfirmed: false },
    { store: store(), intake },
  );
  expect(result).toEqual({ ok: false, code: "CONSENT_REQUIRED" });
  expect(intakeCalls).toHaveLength(0);
});

it("refuses when the message is not genuinely stored", async () => {
  intakeCalls.length = 0;
  const result = await reviewMessengerMessage(
    { messageId: "demo-thread-not-stored", name: "রহিম", phone: "01712345678", consentConfirmed: true },
    { store: store(), intake },
  );
  expect(result).toEqual({ ok: false, code: "MESSAGE_NOT_STORED" });
  expect(intakeCalls).toHaveLength(0);
});

it("refuses when durable storage cannot be read", async () => {
  intakeCalls.length = 0;
  const result = await reviewMessengerMessage(
    { messageId: stored.id, name: "রহিম", phone: "01712345678", consentConfirmed: true },
    { store: store({ loadMessage: async () => "unavailable" }), intake },
  );
  expect(result).toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" });
  expect(intakeCalls).toHaveLength(0);
});

it("refuses an invalid phone instead of inventing one", async () => {
  intakeCalls.length = 0;
  const result = await reviewMessengerMessage(
    { messageId: stored.id, name: "রহিম", phone: "not-a-number", consentConfirmed: true },
    { store: store(), intake },
  );
  expect(result).toEqual({ ok: false, code: "PHONE_REQUIRED" });
  expect(intakeCalls).toHaveLength(0);
});

it("refuses a message already linked to a lead", async () => {
  intakeCalls.length = 0;
  const result = await reviewMessengerMessage(
    { messageId: stored.id, name: "রহিম", phone: "01712345678", consentConfirmed: true },
    { store: store({ loadMessage: async () => ({ ...stored, leadId: "lead-existing" }) }), intake },
  );
  expect(result).toEqual({ ok: false, code: "ALREADY_LINKED" });
  expect(intakeCalls).toHaveLength(0);
});

it("refuses an outbound message as customer evidence", async () => {
  intakeCalls.length = 0;
  const result = await reviewMessengerMessage(
    { messageId: stored.id, name: "রহিম", phone: "01712345678", consentConfirmed: true },
    { store: store({ loadMessage: async () => ({ ...stored, direction: "outbound" }) }), intake },
  );
  expect(result).toEqual({ ok: false, code: "NOT_INBOUND" });
  expect(intakeCalls).toHaveLength(0);
});

it("links the stored message to the lead it produced", async () => {
  const s = store();
  const result = await reviewMessengerMessage(
    { messageId: stored.id, name: "রহিম", phone: "01712345678", consentConfirmed: true },
    { store: s, intake },
  );
  expect(result.ok).toBe(true);
  expect(s.linked).toEqual(["message-1:lead-1"]);
});

it("does not claim success when the lead link cannot be written", async () => {
  const result = await reviewMessengerMessage(
    { messageId: stored.id, name: "রহিম", phone: "01712345678", consentConfirmed: true },
    { store: store({ linkLead: async () => ({ ok: false }) }), intake },
  );
  expect(result).toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" });
});
