import { NOT_CONNECTED } from "@/lib/messenger-shared";

/**
 * Future Meta Messenger service boundary. Every method is a safe stub that
 * reads no secret, touches no database and calls no Meta API. Replace only
 * after the reviewed migration is applied and Meta App Review is complete.
 */
export type MessengerConnection = { connected: false; reason: typeof NOT_CONNECTED.code };

export interface MessengerService {
  connection(): Promise<MessengerConnection>;
  verifyWebhook(params: URLSearchParams): Promise<{ ok: false; status: 503 }>;
  ingestWebhook(rawBody: string, signature: string | null): Promise<{ ok: false; status: 503 }>;
  sendReply(input: { threadId: string; text: string; requestId: string }): Promise<{ ok: false; reason: typeof NOT_CONNECTED.code }>;
}

export const notConnectedMessengerService: MessengerService = {
  async connection() {
    return { connected: false, reason: NOT_CONNECTED.code };
  },
  async verifyWebhook() {
    return { ok: false, status: 503 };
  },
  async ingestWebhook() {
    return { ok: false, status: 503 };
  },
  async sendReply() {
    return { ok: false, reason: NOT_CONNECTED.code };
  },
};

export function getMessengerService(): MessengerService {
  return notConnectedMessengerService;
}
