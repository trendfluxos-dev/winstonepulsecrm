/**
 * Reads every row of an ordered query in 1,000-row pages, several pages at a
 * time instead of one after another. Stops at the first short page, keeps
 * page order, and drops rows repeated across pages (by `id`) when inserts
 * shift the ordering between reads. Any page error fails the whole read so
 * totals are never silently truncated.
 */
export const PAGE_SIZE = 1000;
export const PAGE_CONCURRENCY = 6;
const MAX_PAGES = 200;

type PageResult<T> = { data: T[] | null; error: { message: string } | null | any };

export async function pageAllParallel<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  opts: { pageSize?: number; concurrency?: number } = {},
): Promise<{ data: T[] | null; error: any }> {
  const size = opts.pageSize ?? PAGE_SIZE;
  const conc = Math.max(1, opts.concurrency ?? PAGE_CONCURRENCY);
  const out: T[] = [];
  const seen = new Set<unknown>();
  for (let start = 0; start < MAX_PAGES; start += conc) {
    const batch = await Promise.all(
      Array.from({ length: conc }, (_, i) => {
        const from = (start + i) * size;
        return fetchPage(from, from + size - 1);
      }),
    );
    for (const r of batch) {
      if (r.error) return { data: null, error: r.error };
      const rows = r.data ?? [];
      for (const row of rows) {
        const id = (row as { id?: unknown })?.id;
        if (id !== undefined) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        out.push(row);
      }
      if (rows.length < size) return { data: out, error: null };
    }
  }
  return { data: out, error: null };
}
