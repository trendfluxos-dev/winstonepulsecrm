/** Offline protocol helpers only. Not wired to the disabled webhook or Send API. */
export async function matchesWebhookSignature(rawBody: string, signature: string | null, appSecret: string): Promise<boolean> {
  if (!appSecret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.slice(7).match(/../g) ?? [], (byte) => Number.parseInt(byte, 16));
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(rawBody));
}

/** Exact challenge validation; caller must separately confirm integration is enabled. */
export function webhookChallenge(params: URLSearchParams, expectedToken: string): string | null {
  if (!expectedToken || params.getAll("hub.mode").length !== 1 || params.getAll("hub.verify_token").length !== 1 || params.getAll("hub.challenge").length !== 1) return null;
  if (params.get("hub.mode") !== "subscribe" || params.get("hub.verify_token") !== expectedToken) return null;
  const challenge = params.get("hub.challenge");
  return challenge && /^\d{1,100}$/.test(challenge) ? challenge : null;
}

/** Pure preflight, never authorizes a send; inputs must eventually come from server evidence. */
export function messengerReplyBlock(input: {
  connected: boolean; canReply: boolean; owned: boolean; suppressed: boolean;
  briefingAcknowledged: boolean; maintenanceLocked: boolean; lastInboundAt: number | null; now: number;
}): string | null {
  if (!input.canReply || !input.owned) return "FORBIDDEN";
  if (!input.connected) return "FACEBOOK_NOT_CONNECTED";
  if (input.maintenanceLocked) return "MAINTENANCE_LOCKED";
  if (!input.briefingAcknowledged) return "BRIEFING_REQUIRED";
  if (input.suppressed) return "DO_NOT_CONTACT";
  const inbound = input.lastInboundAt;
  if (inbound === null || !Number.isFinite(inbound) || !Number.isFinite(input.now) || inbound > input.now || input.now - inbound >= 24 * 60 * 60 * 1000) return "MESSAGING_WINDOW_CLOSED";
  return null;
}