/**
 * Vertex AI service-account auth (server-only). Mints a short-lived OAuth
 * access token from the service-account JSON stored in
 * GOOGLE_VERTEX_SERVICE_ACCOUNT. The JSON and the private key never leave the
 * server, are never logged, and failures throw generic secret-safe messages.
 */

export type VertexServiceAccount = {
  clientEmail: string;
  privateKeyPem: string;
  tokenUri: string;
  projectId: string;
};

/** Parse the stored service-account JSON. Throws a generic message on any problem. */
export function parseVertexServiceAccount(raw: string | undefined): VertexServiceAccount {
  if (!raw) throw new Error("Google Vertex AI is not configured");
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const clientEmail = parsed["client_email"];
    const privateKeyPem = parsed["private_key"];
    const projectId = parsed["project_id"];
    if (
      typeof clientEmail !== "string" || !clientEmail.includes("@") ||
      typeof privateKeyPem !== "string" || !privateKeyPem.includes("PRIVATE KEY") ||
      typeof projectId !== "string" || !projectId
    ) {
      throw new Error("bad shape");
    }
    return {
      clientEmail,
      privateKeyPem,
      tokenUri: typeof parsed["token_uri"] === "string" ? parsed["token_uri"] : "https://oauth2.googleapis.com/token",
      projectId,
    };
  } catch {
    throw new Error("Google Vertex AI is not configured");
  }
}

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlText = (text: string): string => b64url(new TextEncoder().encode(text));

/** PEM (PKCS#8) → CryptoKey for RS256 signing. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const der = Uint8Array.from(
    atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")),
    (c) => c.charCodeAt(0),
  );
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Build a signed service-account JWT for the OAuth token exchange. */
export async function buildVertexJwt(account: VertexServiceAccount, nowSeconds: number): Promise<string> {
  const header = b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64urlText(JSON.stringify({
    iss: account.clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: account.tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(account.privateKeyPem);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(signature))}`;
}

// Per-process token cache: tokens live ~1 hour; refresh 5 minutes early.
let cached: { token: string; expiresAt: number } | null = null;

/**
 * Mint (or reuse) an access token. `tokenFetch` is injectable so tests never
 * touch the network. The token endpoint's error body is never read or logged.
 */
export async function mintVertexAccessToken(
  account: VertexServiceAccount,
  tokenFetch: typeof fetch = fetch,
): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 5 * 60_000) return cached.token;
  const jwt = await buildVertexJwt(account, Math.floor(Date.now() / 1000));
  let res: Response;
  try {
    res = await tokenFetch(account.tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
  } catch {
    throw new Error("Google Vertex AI is unavailable right now");
  }
  if (!res.ok) throw new Error("Google Vertex AI access was not accepted");
  const payload = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("Google Vertex AI access was not accepted");
  }
  cached = {
    token: payload.access_token,
    expiresAt: Date.now() + (typeof payload.expires_in === "number" ? payload.expires_in : 3600) * 1000,
  };
  return cached.token;
}

/** Test-only: clear the cached token. */
export function resetVertexTokenCache(): void {
  cached = null;
}
