/** SHA-256 of bytes as lowercase hex (Web Crypto; runs in browser memory only). */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** True only for an exact 64-hex match (case-insensitive). */
export function checksumMatches(actual: string, expected: string): boolean {
  const a = actual.trim().toLowerCase(), e = expected.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(e) && a === e;
}
