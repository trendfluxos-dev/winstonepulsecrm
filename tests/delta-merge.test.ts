import { describe, expect, it } from "vitest";
import { byUpdatedDesc, deltaCursor, mergeDelta } from "@/lib/delta-merge";

const row = (id: string, updated_at: string, v = 0) => ({ id, updated_at, v });

describe("mergeDelta", () => {
  it("replaces changed rows and keeps unchanged ones", () => {
    const out = mergeDelta([row("a", "2026-01-01", 1), row("b", "2026-01-02")], [row("a", "2026-01-03", 2)], 2, byUpdatedDesc);
    expect(out?.map((r) => [r.id, r.v])).toEqual([["a", 2], ["b", 0]]);
  });
  it("adds new rows", () => {
    expect(mergeDelta([row("a", "1")], [row("c", "2")], 2)?.length).toBe(2);
  });
  it("forces a full reload when totals disagree", () => {
    expect(mergeDelta([row("a", "1")], [], 2)).toBeNull();
    expect(mergeDelta([row("a", "1")], [], null)).toBeNull();
  });
  it("moves the cursor back two minutes", () => {
    expect(deltaCursor("2026-10-27T10:02:00.000Z")).toBe("2026-10-27T10:00:00.000Z");
  });
});
