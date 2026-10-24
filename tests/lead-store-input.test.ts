import { describe, expect, it } from "vitest";

import { StoreInput } from "@/lib/lead-pool.functions";

describe("lead store listing input", () => {
  it("accepts the default page size (200) when limit is omitted", () => {
    // Regression: limit must not be capped by the 50/day assignment cap,
    // otherwise every LeadHub lead-database call without limit fails.
    const parsed = StoreInput.parse({});
    expect(parsed.limit).toBe(200);
  });

  it("accepts explicit page sizes up to 500", () => {
    expect(StoreInput.parse({ limit: 500 }).limit).toBe(500);
  });

  it("rejects page sizes above 500 and non-integers", () => {
    expect(() => StoreInput.parse({ limit: 501 })).toThrow();
    expect(() => StoreInput.parse({ limit: 10.5 })).toThrow();
    expect(() => StoreInput.parse({ limit: 0 })).toThrow();
  });
});
