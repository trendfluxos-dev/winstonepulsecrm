/**
 * CRM-authorized WhatsApp template identifiers (browser-safe shared rules).
 *
 * Staff may only request one of these templates through the Meta
 * Cloud API — never free-form text. The `name` must match the template
 * approved by Meta before use; this list does not prove provider approval.
 * Variables are positional ({{1}}, {{2}}…).
 */
import { z } from "zod";
export type WhatsAppTemplate = {
  /** Internal id used in the CRM. */
  id: string;
  /** Meta-approved template name. */
  name: string;
  /** Bengali label shown in the picker. */
  label: string;
  /** Positional variable labels, in {{1}}, {{2}}… order. */
  variables: readonly string[];
};

export const WHATSAPP_TEMPLATES: readonly WhatsAppTemplate[] = [
  {
    id: "follow_up_reminder",
    name: "follow_up_reminder",
    label: "ফলো-আপ রিমাইন্ডার",
    variables: ["ক্রেতার নাম"],
  },
  {
    id: "site_visit_confirmation",
    name: "site_visit_confirmation",
    label: "সাইট ভিজিট নিশ্চিতকরণ",
    variables: ["ক্রেতার নাম", "ভিজিটের তারিখ"],
  },
  {
    id: "brochure_share",
    name: "brochure_share",
    label: "ব্রোশিওর শেয়ার",
    variables: ["ক্রেতার নাম"],
  },
  {
    id: "payment_reminder",
    name: "payment_reminder",
    label: "পেমেন্ট রিমাইন্ডার",
    variables: ["ক্রেতার নাম", "বকেয়া পরিমাণ"],
  },
] as const;

export function findWhatsAppTemplate(id: string): WhatsAppTemplate | null {
  return WHATSAPP_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Reject body/text overrides and free prose disguised as template parameters. */
export const WhatsappTemplateInput = z.object({
  adminToken: z.string().nullable().optional(),
  leadId: z.string().uuid(),
  template: z.string().trim().min(1).max(80),
  variables: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
}).strict().superRefine((data, ctx) => {
  const template = findWhatsAppTemplate(data.template);
  if (!template) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["template"], message: "শুধু অনুমোদিত টেমপ্লেট পাঠানো যায়" });
    return;
  }
  if (data.variables.length !== template.variables.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variables"], message: "টেমপ্লেটের সব তথ্য পূরণ করুন" });
    return;
  }
  data.variables.forEach((value, i) => {
    const label = template.variables[i];
    const valid = label === "ভিজিটের তারিখ"
      ? /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
      : label === "বকেয়া পরিমাণ"
        ? /^\d{1,10}(\.\d{1,2})?$/.test(value) && Number(value) > 0
        : value.length <= 60 && /^[\p{L}\p{M}]+(?:[ .'-][\p{L}\p{M}]+)*$/u.test(value);
    if (!valid) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variables", i], message: `${label}: সঠিক তথ্য দিন (নাম / YYYY-MM-DD / পরিমাণ)` });
  });
});

/** Dhaka calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function dhakaDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Visit dates and payment amounts must come from saved CRM records, never the
 * caller: the date must match a non-cancelled site visit for the lead and the
 * amount must match an HQ-approved booking amount for the lead.
 */
export function savedFactsMatch(
  template: WhatsAppTemplate,
  variables: readonly string[],
  facts: { visitAts: readonly string[]; approvedAmounts: readonly number[] },
): string | null {
  for (const [i, label] of template.variables.entries()) {
    const value = variables[i] ?? "";
    if (label === "ভিজিটের তারিখ" && !facts.visitAts.some((at) => dhakaDate(at) === value)) {
      return "ভিজিটের তারিখ এই লিডের সংরক্ষিত সাইট ভিজিটের সাথে মিলছে না";
    }
    if (label === "বকেয়া পরিমাণ" && !facts.approvedAmounts.some((a) => Math.abs(a - Number(value)) < 0.005)) {
      return "পরিমাণটি এই লিডের অনুমোদিত বুকিংয়ের সাথে মিলছে না";
    }
  }
  return null;
}
