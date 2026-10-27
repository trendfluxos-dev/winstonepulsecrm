import { describe, expect, it } from "vitest";
import { pageAllParallel } from "@/lib/page-all";

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));

function source(all: { id: string }[], failAt?: number) {
  return (from: number, to: number) =>
    Promise.resolve(
      failAt !== undefined && from === failAt
        ? { data: null, error: { message: "boom" } }
        : { data: all.slice(from, to + 1), error: null },
    );
}

describe("pageAllParallel", () => {
  it("returns every row in order across many pages (9,545 rows)", async () => {
    const all = rows(9545);
    const { data, error } = await pageAllParallel(source(all));
    expect(error).toBeNull();
    expect(data).toHaveLength(9545);
    expect(data?.[0].id).toBe("r0");
    expect(data?.[9544].id).toBe("r9544");
  });

  it("handles an exact multiple of the page size", async () => {
    const { data } = await pageAllParallel(source(rows(6000)));
    expect(data).toHaveLength(6000);
  });

  it("fails the whole read when any page errors, never a partial total", async () => {
    const { data, error } = await pageAllParallel(source(rows(5000), 3000));
    expect(data).toBeNull();
    expect(error?.message).toBe("boom");
  });

  it("drops rows repeated across pages by id", async () => {
    const all = rows(1500);
    const shifted = (from: number, to: number) =>
      Promise.resolve({ data: from === 1000 ? all.slice(999, 1500) : all.slice(from, to + 1), error: null });
    const { data } = await pageAllParallel(shifted);
    expect(data).toHaveLength(1500);
  });
});
