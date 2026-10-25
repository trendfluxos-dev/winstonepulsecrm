/** Public preparation state, not a provider check or a secret inventory. */
export function messengerPreparation() {
  return {
    connected: false as const,
    appApproval: "unverified" as const,
    pageConsent: "unverified" as const,
    webhook: "disabled" as const,
    inbox: "demo" as const,
    phoneSyncRequiresFacebook: false as const,
  };
}