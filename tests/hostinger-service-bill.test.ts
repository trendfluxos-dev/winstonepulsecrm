import { describe, expect, it } from "vitest";

import {
  buildHostingerServiceBillPayload,
  HOSTINGER_MAIL_API,
  SERVICE_BILL_SENDER,
} from "@/lib/email-templates/hostinger-send.server";

describe("Hostinger service-bill payload", () => {
  it("keeps system mail English-first, with Bengali as an optional body line", () => {
    expect(
      buildHostingerServiceBillPayload({
        recipient: "hq@example.com",
        stage: "Due Today",
        stageBn: "মেয়াদ শেষ",
      }),
    ).toEqual({
      to: ["hq@example.com"],
      displayName: "Winstone IT Team",
      subject: "Service-Bill Alert: Due Today - Winstone Pulse",
      text: "WINSTONE PULSE — SERVICE BILL ALERT\n\nStatus: Due Today\nবাংলা: মেয়াদ শেষ\nAmount: $35.29 USD/month (incl. 15% VAT $4.60)\n\nThis notice requires authorized human review. It does not execute or approve a payment.",
    });
  });

  it("omits the Bengali courtesy line when no Bengali status is provided", () => {
    const payload = buildHostingerServiceBillPayload({
      recipient: "hq@example.com",
      stage: "Overdue",
    });
    expect(payload.subject).toBe("Service-Bill Alert: Overdue - Winstone Pulse");
    expect(payload.text).toContain("Status: Overdue");
    expect(payload.text).not.toContain("বাংলা");
  });

  it("sends only from the fixed mailbox via the official API host", () => {
    expect(SERVICE_BILL_SENDER).toBe("info@winstonebd.com");
    expect(HOSTINGER_MAIL_API).toBe("https://api.mail.hostinger.com");
  });
});
