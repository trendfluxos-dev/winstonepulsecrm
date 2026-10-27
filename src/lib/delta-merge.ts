/**
 * Merges a "changed rows only" refresh into the rows already on screen.
 * Rows are matched by id (changed rows replace old copies), then sorted.
 * Returns null when the merged total disagrees with the server's total —
 * the caller must then do a full reload so counts are never wrong.
 */
export const DELTA_OVERLAP_MS = 120_000;

export function mergeDelta<T extends { id: string }>(
  previous: T[],
  changed: T[],
  serverTotal: number | null,
  compare?: (a: T, b: T) => number,
): T[] | null {
  const byId = new Map(previous.map((r) => [r.id, r]));
  for (const r of changed) byId.set(r.id, r);
  const merged = [...byId.values()];
  if (serverTotal == null || merged.length !== serverTotal) return null;
  if (compare) merged.sort(compare);
  return merged;
}

/** Cursor for the next delta read, moved back to absorb late commits. */
export function deltaCursor(serverTime: string): string {
  return new Date(new Date(serverTime).getTime() - DELTA_OVERLAP_MS).toISOString();
}

export const byUpdatedDesc = (a: { id: string; updated_at: string }, b: { id: string; updated_at: string }) =>
  String(b.updated_at).localeCompare(String(a.updated_at)) || a.id.localeCompare(b.id);

export const byCreatedAsc = (a: { id: string; created_at: string }, b: { id: string; created_at: string }) =>
  String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id);
