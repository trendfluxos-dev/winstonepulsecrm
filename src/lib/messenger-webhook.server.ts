import { matchesWebhookSignature } from "@/lib/messenger-protocol.server";
import { validateMetaWebhookBytes } from "@/lib/meta-webhook-payload";

export const MAX_WEBHOOK_BYTES = 262144;
const refusal = (status: number, code: string) => Response.json({ ok: false, code }, { status, headers: { "Cache-Control": "no-store" } });

/** Validate signatures without accepting messages until durable ingestion is reviewed. */
export async function inspectSignedWebhook(request: Request, appSecret: string | undefined) {
  if (!appSecret) return refusal(503, "FACEBOOK_NOT_CONNECTED");
  const signature = request.headers.get("x-hub-signature-256");
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return refusal(401, "INVALID_WEBHOOK_SIGNATURE");
  const reader = request.body?.getReader();
  if (!reader) return refusal(400, "EMPTY_WEBHOOK_BODY");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return refusal(413, "WEBHOOK_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } catch { return refusal(400, "UNREADABLE_WEBHOOK_BODY"); }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (!await matchesWebhookSignature(bytes, signature, appSecret)) return refusal(401, "INVALID_WEBHOOK_SIGNATURE");
  if (!validateMetaWebhookBytes(bytes).valid) return refusal(400, "INVALID_WEBHOOK_PAYLOAD");
  // Never acknowledge 200: valid signatures do not prove Page consent or durable receipt.
  return refusal(503, "MESSENGER_INGESTION_NOT_READY");
}