import { describe, expect, it } from "vitest";

import { WHATSAPP_TEMPLATES, findWhatsAppTemplate } from "@/lib/whatsapp-templates";

describe("whatsapp template allow-list", () => {
  it("only known template ids resolve", () => {
    expect(findWhatsAppTemplate("follow_up_reminder")?.name).toBe("follow_up_reminder");
    expect(findWhatsAppTemplate("free_text")).toBeNull();
    expect(findWhatsAppTemplate("")).toBeNull();
    expect(findWhatsAppTemplate("'; DROP TABLE leads;--")).toBeNull();
  });

  it("every template has a Meta name, a Bengali label and bounded variables", () => {
    for (const t of WHATSAPP_TEMPLATES) {
      expect(t.name).toMatch(/^[a-z0-9_]+$/);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.variables.length).toBeLessThanOrEqual(10);
    }
  });

  it("ids are unique", () => {
    const ids = WHATSAPP_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
