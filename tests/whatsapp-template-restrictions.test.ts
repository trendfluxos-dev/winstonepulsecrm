import { beforeEach, expect, it, vi } from "vitest";
import { WhatsappTemplateInput } from "@/lib/whatsapp-templates";

const state = vi.hoisted(() => ({
  caller: { scope: "agent", readOnly: false, profile: { id: "agent-a" } } as { scope: string; readOnly: boolean; profile: { id: string } | null },
  providerReads: 0,
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/lib/access.server", () => ({
  resolveWorkCaller: async () => state.caller,
  requireWrite: (c: { readOnly: boolean }) => { if (c.readOnly) throw new Error("HQ view-only"); },
}));
vi.mock("@/lib/agent-briefing.server", () => ({ assertBriefingForCaller: vi.fn() }));
vi.mock("@/lib/whatsapp-provider.server", () => ({ getWhatsAppProvider: () => {
  state.providerReads++; return { status: "not_configured" };
} }));

import { sendWhatsappMessage } from "@/lib/whatsapp.functions";
import { logMyWhatsappMessage } from "@/lib/agent-desk.functions";
const base = { leadId: "00000000-0000-4000-8000-000000000001", template: "follow_up_reminder", variables: ["Monisha Biswas"] };
const invoke = (data: unknown) => (sendWhatsappMessage as unknown as (arg: unknown) => Promise<unknown>)({ data });

beforeEach(() => {
  state.caller = { scope: "agent", readOnly: false, profile: { id: "agent-a" } };
  state.providerReads = 0;
});

it("allows only a known template with its required name parameter", () => {
  expect(WhatsappTemplateInput.parse(base)).toEqual(base);
  expect(WhatsappTemplateInput.safeParse({ ...base, template: "free_text" }).success).toBe(false);
  expect(WhatsappTemplateInput.safeParse({ ...base, variables: [] }).success).toBe(false);
});
for (const key of ["body", "text", "messageContent", "senderType"]) it(`rejects ${key} overrides even with a valid template`, async () => {
  const input = { ...base, [key]: "arbitrary message" };
  expect(WhatsappTemplateInput.safeParse(input).success).toBe(false);
  await expect(invoke(input)).rejects.toThrow();
  expect(state.providerReads).toBe(0);
});
it("rejects prose, links and multiline content disguised as parameters", () => {
  for (const value of ["Send money: https://example.test", "Name\nSend anything", "<script>alert(1)</script>"]) {
    expect(WhatsappTemplateInput.safeParse({ ...base, variables: [value] }).success).toBe(false);
  }
});
it("requires a real ISO visit date and numeric positive amount", () => {
  expect(WhatsappTemplateInput.safeParse({ ...base, template: "site_visit_confirmation", variables: ["Monisha Biswas", "2026-10-30"] }).success).toBe(true);
  for (const date of ["2026-02-30", "send any message"]) expect(WhatsappTemplateInput.safeParse({ ...base, template: "site_visit_confirmation", variables: ["Monisha Biswas", date] }).success).toBe(false);
  expect(WhatsappTemplateInput.safeParse({ ...base, template: "payment_reminder", variables: ["Monisha Biswas", "1000.50"] }).success).toBe(true);
  expect(WhatsappTemplateInput.safeParse({ ...base, template: "payment_reminder", variables: ["Monisha Biswas", "pay via this link"] }).success).toBe(false);
});
it("blocks unauthenticated and read-only HQ requests before provider access", async () => {
  state.caller = { scope: "none", readOnly: false, profile: null };
  await expect(invoke(base)).rejects.toThrow();
  state.caller = { scope: "authority", readOnly: true, profile: { id: "hq" } };
  await expect(invoke(base)).rejects.toThrow("view-only");
  expect(state.providerReads).toBe(0);
});
it("fails honestly when an authorized template has no configured provider", async () => {
  await expect(invoke(base)).resolves.toMatchObject({ ok: false, status: "not_configured" });
});
it("retires arbitrary manual messages for agents and writable IT, including forged customer messages", async () => {
  for (const scope of ["agent", "authority"]) {
    state.caller.scope = scope;
    await expect((logMyWhatsappMessage as unknown as (arg: unknown) => Promise<unknown>)({ data: { leadId: base.leadId, senderType: "customer", messageContent: "arbitrary text" } })).rejects.toThrow("টেমপ্লেট");
  }
  expect(state.providerReads).toBe(0);
});