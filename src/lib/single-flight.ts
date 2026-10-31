/**
 * Calls made while a previous call is still running get that same promise
 * instead of starting a second request. Once it settles, the next call runs again.
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inflight: Promise<T> | null = null;
  return () => {
    if (inflight) return inflight;
    const p = fn().finally(() => {
      if (inflight === p) inflight = null;
    });
    inflight = p;
    return p;
  };
}
