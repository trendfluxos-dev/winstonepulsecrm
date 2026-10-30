import { describe, it, expect } from "vitest";
import { findWhatsAppTemplate, savedFactsMatch } from "@/lib/whatsapp-templates";
import { isGrantRecipientEligible } from "@/lib/floor-lock.functions";

const visit = findWhatsAppTemplate("site_visit_confirmation")!;
const pay = findWhatsAppTemplate("payment_reminder")!;

describe("WhatsApp values come from saved records", () => {
  it("rejects a forged visit date", () => {
    expect(savedFactsMatch(visit, ["Rahim", "2026-11-05"], { visitAts: ["2026-11-02T05:00:00Z"], approvedAmounts: [] })).not.toBeNull();
  });
  it("accepts the saved visit date in Dhaka time", () => {
    expect(savedFactsMatch(visit, ["Rahim", "2026-11-03"], { visitAts: ["2026-11-02T19:00:00Z"], approvedAmounts: [] })).toBeNull();
  });
  it("rejects a forged payment amount and accepts the approved one", () => {
    expect(savedFactsMatch(pay, ["Rahim", "999"], { visitAts: [], approvedAmounts: [1500] })).not.toBeNull();
    expect(savedFactsMatch(pay, ["Rahim", "1500"], { visitAts: [], approvedAmounts: [1500] })).toBeNull();
  });
});

describe("held leads never reach revoked accounts", () => {
  it("only active approved staff are eligible", () => {
    expect(isGrantRecipientEligible({ is_active: true, approval_status: "approved" })).toBe(true);
    expect(isGrantRecipientEligible({ is_active: true, approval_status: "revoked" })).toBe(false);
    expect(isGrantRecipientEligible({ is_active: false, approval_status: "approved" })).toBe(false);
  });
});
