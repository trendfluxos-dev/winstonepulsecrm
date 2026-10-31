import { describe, expect, it } from "vitest";
import {
  dailyProgressParams, inNewLeadWindow, isOptOutText, newLeadsSinceLastAlert,
  nextAlertStatus, normalizeAgentWhatsApp,
} from "@/lib/agent-whatsapp";

describe("agent WhatsApp alerts", () => {
  it("accepts Bangladesh mobiles in any common form and rejects others", () => {
    expect(normalizeAgentWhatsApp("01712-345678")).toBe("8801712345678");
    expect(normalizeAgentWhatsApp("+880 1712 345678")).toBe("8801712345678");
    expect(normalizeAgentWhatsApp("1712345678")).toBe("8801712345678");
    expect(normalizeAgentWhatsApp("01212345678")).toBeNull();
    expect(normalizeAgentWhatsApp("+1 415 555 0100")).toBeNull();
  });

  it("treats STOP and বন্ধ as opt-out, normal replies are not", () => {
    expect(isOptOutText(" STOP ")).toBe(true);
    expect(isOptOutText("বন্ধ।")).toBe(true);
    expect(isOptOutText("ok thanks")).toBe(false);
  });

  it("alerts only for leads added since the last alert", () => {
    expect(newLeadsSinceLastAlert(12, 5)).toBe(7);
    expect(newLeadsSinceLastAlert(5, 5)).toBe(0);
    expect(newLeadsSinceLastAlert(null, 0)).toBeNull();
  });

  it("never moves a delivered or read alert backwards", () => {
    expect(nextAlertStatus("accepted", "sent")).toBe("sent");
    expect(nextAlertStatus("read", "sent")).toBe("read");
    expect(nextAlertStatus("delivered", "failed")).toBe("delivered");
    expect(nextAlertStatus("sent", "failed")).toBe("failed");
  });

  it("daily progress carries counts only, in template order", () => {
    expect(dailyProgressParams({ name: "Rahim", dayLabel: "31 Oct", received: 48, quota: 50, reports: 40, followUps: 6 }))
      .toEqual(["Rahim", "31 Oct", "48", "50", "40", "6"]);
  });

  it("new-lead alerts run 09:00–17:35 Dhaka only", () => {
    expect(inNewLeadWindow(new Date("2026-10-31T03:00:00Z"))).toBe(true); // 09:00 Dhaka
    expect(inNewLeadWindow(new Date("2026-10-31T02:59:00Z"))).toBe(false);
    expect(inNewLeadWindow(new Date("2026-10-31T11:40:00Z"))).toBe(false); // 17:40 Dhaka
  });
});

import { hqReportDedupeKey, hqReportParams } from "@/lib/agent-whatsapp";
describe("HQ report summary", () => {
  it("carries counts only, in template order", () => {
    expect(hqReportParams({ name: "Rahim", dayLabel: "31 Oct", reports: 12, verifiedConnected: 8, followUps: 3 }))
      .toEqual(["Rahim", "31 Oct", "12", "8", "3"]);
  });
  it("resends only when the day's counts change", () => {
    const a = hqReportDedupeKey("a1", "2026-10-31", { reports: 12, verifiedConnected: 8, followUps: 3 });
    expect(hqReportDedupeKey("a1", "2026-10-31", { reports: 12, verifiedConnected: 8, followUps: 3 })).toBe(a);
    expect(hqReportDedupeKey("a1", "2026-10-31", { reports: 13, verifiedConnected: 8, followUps: 3 })).not.toBe(a);
  });
});
