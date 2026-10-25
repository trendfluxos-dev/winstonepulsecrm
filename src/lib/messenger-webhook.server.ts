import { matchesWebhookSignature } from "@/lib/messenger-protocol.server";
import { validateMetaWebhookBytes } from "@/lib/meta-webhook-payload";
import { ingestMessengerWebhook, MAX_WEBHOOK_BYTES, type MessengerStore } from "@/lib/messenger-ingest.server";

export { MAX_WEBHOOK_BYTES };

const refusal = (status: number, code: string) =>
  Response.json({ ok: false, code }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Validate the raw body, then hand it to the durable pipeline. The pipeline
 * refuses until the reviewed storage migration is applied and Meta approvals
 * are verified, so a valid signature still never becomes an accepted message.
 */
export async function inspectSignedWebhook(
  request: Request,
  appSecret: string | undefined,
  options: { store?: MessengerStore; enabled?: boolean } = {},
) {
  // 403, not 503: Meta only needs a non-200 to treat delivery as failed,
  // and a 5xx response blanks the preview with a runtime-error overlay.
  if (!appSecret) return refusal(403, "FACEBOOK_NOT_CONNECTED");
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
  } catch {
    return refusal(400, "UNREADABLE_WEBHOOK_BODY");
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!await matchesWebhookSignature(bytes, signature, appSecret)) return refusal(401, "INVALID_WEBHOOK_SIGNATURE");
  if (!validateMetaWebhookBytes(bytes).valid) return refusal(400, "INVALID_WEBHOOK_PAYLOAD");

  const result = await ingestMessengerWebhook({ bytes, signature, appSecret, store: options.store, enabled: options.enabled });
  if (result.ok) return Response.json({ ok: true, stored: result.stored, duplicates: result.duplicates }, { headers: { "Cache-Control": "no-store" } });
  return refusal(result.status, result.code);
}
