import { expect, it } from "vitest";
import { messengerPreparation } from "@/lib/messenger-readiness";
import { integrationPreparation } from "@/lib/integration-readiness";
it("preparation never claims App/Page approval or a working real inbox", () => {
  expect(messengerPreparation()).toEqual({ connected: false, appApproval: "unverified", pageConsent: "unverified", webhook: "disabled", inbox: "demo", phoneSyncRequiresFacebook: false });
});
it("combined preparation flags neither service as connected and does not infer secret configuration", () => {
  const state = integrationPreparation();
  expect(state.messenger.connected).toBe(false);
  expect(state.windsor.connected).toBe(false);
  expect(state.windsor.configuration).toBe("not_checked");
  expect(state.noneConnected).toBe(true);
});