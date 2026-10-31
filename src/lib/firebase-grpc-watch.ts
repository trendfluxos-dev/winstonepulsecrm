/**
 * Pure helpers for the daily Firebase → @grpc/grpc-js watch.
 * Firebase's Firestore part pins @grpc/grpc-js; the advisory GHSA-m9gg-hp2v-232j
 * is fixed in 1.13.6. We only need to know whether the latest Firebase release
 * allows a fixed grpc-js version.
 */
export const GRPC_FIXED_VERSION = "1.13.6";
export const GRPC_ADVISORY = "GHSA-m9gg-hp2v-232j";

type V = [number, number, number];

function parse(v: string): V | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a: V, b: V): number {
  for (let i = 0; i < 3; i++) if (a[i]! !== b[i]!) return a[i]! - b[i]!;
  return 0;
}

/**
 * Does a single npm range (exact, ~x.y.z, ^x.y.z, >=x.y.z) allow a version at
 * or above `fixed`? Returns null for range formats we do not understand, so the
 * caller never raises a false "fixed" alert.
 */
export function rangeAllowsFixed(range: string, fixed = GRPC_FIXED_VERSION): boolean | null {
  const target = parse(fixed);
  const r = range.trim();
  if (!target || !r || /\|\||\s-\s|\s/.test(r)) return null;
  const op = /^(>=|\^|~|=)?v?(.*)$/.exec(r);
  const base = op ? parse(op[2]) : null;
  if (!op || !base || /[x*]/i.test(op[2])) return null;
  const kind = op[1] ?? "=";
  if (kind === ">=") return true;
  if (kind === "=") return cmp(base, target) >= 0;
  // Highest allowed version is below the next breaking boundary.
  const upper: V =
    kind === "~"
      ? [base[0], base[1] + 1, 0]
      : base[0] > 0
        ? [base[0] + 1, 0, 0]
        : base[1] > 0
          ? [0, base[1] + 1, 0]
          : [0, 0, base[2] + 1];
  return cmp(upper, target) > 0;
}

export type WatchVerdict = {
  firebaseVersion: string;
  firestoreVersion: string | null;
  grpcRange: string | null;
  fixed: boolean | null;
};

/** Decide from registry manifests whether the latest Firebase resolves the advisory. */
export function evaluateFirebase(
  firebase: { version: string; dependencies?: Record<string, string> },
  firestore: { version: string; dependencies?: Record<string, string> } | null,
): WatchVerdict {
  const grpcRange = firestore?.dependencies?.["@grpc/grpc-js"] ?? firebase.dependencies?.["@grpc/grpc-js"] ?? null;
  return {
    firebaseVersion: firebase.version,
    firestoreVersion: firestore?.version ?? null,
    grpcRange,
    // No grpc-js dependency at all means Firebase dropped it, which also resolves the advisory.
    fixed: grpcRange === null ? (firestore ? true : null) : rangeAllowsFixed(grpcRange),
  };
}

/** Alert exactly once: the first time any Firebase release allows the fix. */
export function shouldAlert(verdict: WatchVerdict, previous: { alertedFor?: string | null } | null): boolean {
  return verdict.fixed === true && !previous?.alertedFor;
}
