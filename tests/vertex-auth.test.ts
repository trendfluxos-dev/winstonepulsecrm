import { describe, expect, it, vi } from "vitest";

import {
  buildVertexJwt,
  mintVertexAccessToken,
  parseVertexServiceAccount,
  resetVertexTokenCache,
  type VertexServiceAccount,
} from "@/lib/vertex-auth.server";

/** Generate a synthetic RSA key pair and return it as a service-account PEM. */
async function syntheticAccount(): Promise<VertexServiceAccount> {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
  return {
    clientEmail: "synthetic@example.iam.gserviceaccount.com",
    privateKeyPem: pem,
    tokenUri: "https://oauth2.googleapis.com/token",
    projectId: "synthetic-project",
  };
}

describe("parseVertexServiceAccount — fail-closed, secret-safe", () => {
  it("refuses missing or malformed JSON with a generic message", () => {
    expect(() => parseVertexServiceAccount(undefined)).toThrow("Google Vertex AI is not configured");
    expect(() => parseVertexServiceAccount("not json")).toThrow("Google Vertex AI is not configured");
    expect(() => parseVertexServiceAccount("{}")).toThrow("Google Vertex AI is not configured");
    expect(() => parseVertexServiceAccount(JSON.stringify({ client_email: "x@y", private_key: "nope", project_id: "p" }))).toThrow();
  });

  it("parses a well-formed service account", () => {
    const account = parseVertexServiceAccount(JSON.stringify({
      client_email: "a@b.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----",
      project_id: "proj",
    }));
    expect(account.projectId).toBe("proj");
    expect(account.tokenUri).toBe("https://oauth2.googleapis.com/token");
  });

  it("error messages never echo the stored JSON", () => {
    const secretish = JSON.stringify({ client_email: "a@b", private_key: "-----BEGIN PRIVATE KEY-----\nSUPERSECRETKEYMATERIAL\n-----END PRIVATE KEY-----", project_id: 42 });
    try {
      parseVertexServiceAccount(secretish);
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("SUPERSECRETKEYMATERIAL");
    }
  });
});

describe("buildVertexJwt", () => {
  it("builds a verifiable RS256 JWT with the right claims", async () => {
    const account = await syntheticAccount();
    const jwt = await buildVertexJwt(account, 1_700_000_000);
    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(atob(header.replace(/-/g, "+").replace(/_/g, "/")))).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    expect(claims.iss).toBe(account.clientEmail);
    expect(claims.aud).toBe(account.tokenUri);
    expect(claims.exp).toBe(1_700_000_000 + 3600);
    expect(claims.scope).toContain("cloud-platform");
    expect(signature.length).toBeGreaterThan(100);
  });
});

describe("mintVertexAccessToken", () => {
  it("exchanges the JWT and caches the token", async () => {
    resetVertexTokenCache();
    const account = await syntheticAccount();
    const tokenFetch = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "synthetic-access-token", expires_in: 3600 }), { status: 200 }));
    const token = await mintVertexAccessToken(account, tokenFetch as never);
    expect(token).toBe("synthetic-access-token");
    // Second call uses the cache — no second exchange.
    expect(await mintVertexAccessToken(account, tokenFetch as never)).toBe("synthetic-access-token");
    expect(tokenFetch).toHaveBeenCalledTimes(1);
  });

  it("refuses with generic messages on rejection or transport failure", async () => {
    resetVertexTokenCache();
    const account = await syntheticAccount();
    const denied = vi.fn(async () => new Response("provider detail must not leak", { status: 400 }));
    await expect(mintVertexAccessToken(account, denied as never)).rejects.toThrow("access was not accepted");
    const down = vi.fn(async () => { throw new Error("network detail must not leak"); });
    await expect(mintVertexAccessToken(account, down as never)).rejects.toThrow("unavailable");
  });
});
