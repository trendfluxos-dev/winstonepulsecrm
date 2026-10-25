/**
 * Approved WhatsApp Business templates (browser-safe shared rules).
 *
 * Staff may only send one of these pre-approved templates through the Meta
 * Cloud API — never free-form text. The `name` must match the template
 * approved in Meta Business Manager; variables are positional ({{1}}, {{2}}…).
 */
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
