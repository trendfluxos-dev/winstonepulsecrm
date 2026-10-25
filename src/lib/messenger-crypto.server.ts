/**
 * Server-side encryption at rest for Messenger message bodies.
 *
 * AES-256-GCM through Web Crypto (workerd-safe). The key lives only in the
 * MESSENGER_MESSAGE_KEY server secret and is read inside each call, never at
 * module scope. Ciphertext format: v1.<iv>.<ciphertext> in base64url.
 *
 * Fail-closed: without a configured key, encryption returns null and the
 * caller must refuse to store the message rather than fall back to plaintext.
 */

const KEY_ENV = "MESSENGER_MESSAGE_KEY";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function unb64url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function messageKey(env: Record<string, string | undefined>): Promise<CryptoKey | null> {
  const raw = env[KEY_ENV];
  if (!raw || raw.length < 32) return null;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** null when the server key is missing — the caller must refuse to store. */
export async function encryptMessageBody(
  plaintext: string,
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  const key = await messageKey(env);
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  return `v1.${b64url(iv)}.${b64url(new Uint8Array(ciphertext))}`;
}

/** null when the key is missing, the format is unknown, or the ciphertext was tampered with. */
export async function decryptMessageBody(
  ciphertext: string,
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  const key = await messageKey(env);
  if (!key) return null;
  const parts = ciphertext.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64url(parts[1]) as BufferSource },
      key,
      unb64url(parts[2]) as BufferSource,
    );
    return decoder.decode(plaintext);
  } catch {
    return null;
  }
}
