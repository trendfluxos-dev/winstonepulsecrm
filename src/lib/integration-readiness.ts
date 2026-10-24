import { messengerPreparation } from "@/lib/messenger-readiness";

/** Preparation only: no secret inspection, provider requests or invented metrics. */
export function integrationPreparation() {
  const messenger = messengerPreparation();
  const windsor = { connected: false as const, contract: "unverified" as const, configuration: "not_checked" as const };
  return { messenger, windsor, noneConnected: !messenger.connected && !windsor.connected };
}