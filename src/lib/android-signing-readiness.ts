/**
 * Pure rules for "can a signed LIVE agent app be built?". Names only — this module never
 * sees a secret value, and the server read that feeds it lists names only.
 */

/** The four GitHub Actions secrets the "Android APKs" release job requires. */
export const REQUIRED_SIGNING_SECRETS = [
  "WINSTONE_KEYSTORE_B64",
  "WINSTONE_KEYSTORE_PASSWORD",
  "WINSTONE_KEY_ALIAS",
  "WINSTONE_KEY_PASSWORD",
] as const;

/** Public company certificate fingerprint the release check compares against. */
export const FINGERPRINT_VARIABLE = "WINSTONE_RELEASE_CERT_SHA256";

/** Live agent app identity; changing it (or the signer) breaks in-place updates. */
export const LIVE_PACKAGE_ID = "com.winstone.connect";
export const TEST_PACKAGE_ID = "com.winstone.connect.test";

export type SigningVerdict = "ready" | "blocked" | "check_failed";

export type SigningReadiness = {
  verdict: SigningVerdict;
  /** Required secret names that are absent. Empty when unknown (check_failed). */
  missingSecrets: string[];
  fingerprintRecorded: boolean | null;
};

/**
 * `null` lists mean GitHub could not be read: never reported as "missing" or "ready".
 * Ready only when all four secrets AND the trusted fingerprint variable exist.
 */
export function classifySigningReadiness(
  secretNames: readonly string[] | null,
  variableNames: readonly string[] | null,
): SigningReadiness {
  if (secretNames === null || variableNames === null) {
    return { verdict: "check_failed", missingSecrets: [], fingerprintRecorded: null };
  }
  const have = new Set(secretNames.map((n) => n.toUpperCase()));
  const missingSecrets = REQUIRED_SIGNING_SECRETS.filter((n) => !have.has(n));
  const fingerprintRecorded = variableNames.some((n) => n.toUpperCase() === FINGERPRINT_VARIABLE);
  return {
    verdict: missingSecrets.length === 0 && fingerprintRecorded ? "ready" : "blocked",
    missingSecrets,
    fingerprintRecorded,
  };
}
