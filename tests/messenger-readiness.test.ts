import { expect, it } from "vitest";
import { messengerPreparation } from "@/lib/messenger-readiness";
it("preparation never claims App/Page approval or a working real inbox", () => {
  expect(messengerPreparation()).toEqual({ connected: false, appApproval: "unverified", pageConsent: "unverified", webhook: "disabled", inbox: "demo", phoneSyncRequiresFacebook: false });
});