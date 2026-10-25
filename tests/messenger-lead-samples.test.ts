import { describe, expect, it } from "vitest";
import { messengerLeadSample } from "@/lib/messenger-lead-samples";
import { messengerLeadLookupAllowed } from "@/lib/messenger-lead-details";

describe("local-only Messenger samples", () => {
  it("only returns synthetic fixtures for explicit demo identities", () => {
    expect(messengerLeadSample("demo-1")?.source).toBe("synthetic_demo");
    expect(messengerLeadSample("demo-2")?.source).toBe("synthetic_demo");
    expect(messengerLeadSample("live-thread")).toBeNull();
  });
  it("has complete, missing-value and unlinked samples without real phone data", () => {
    expect(messengerLeadSample("demo-1")?.grade).toBe("B");
    expect(messengerLeadSample("demo-2")?.address).toBeNull();
    expect(messengerLeadSample("demo-2")?.grade).toBeNull();
    expect(messengerLeadSample("demo-3")).toBeNull();
    expect(messengerLeadSample("demo-4")).toBeNull();
  });
  it("sample identities cannot authorize a customer lookup even when connected", () => {
    for (const id of ["demo-1", "demo-2", "demo-3", "demo-4"]) expect(messengerLeadLookupAllowed(true, { id })).toBe(false);
  });
});