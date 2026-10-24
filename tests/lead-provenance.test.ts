import { expect, it } from "vitest";
import { leadProvenance } from "@/lib/lead-provenance";

it("keeps saved Messenger source without inventing original arrival or verified connection", () => {
  expect(leadProvenance({ source: "facebook_messenger" })).toEqual({ source: "facebook_messenger", messenger: true, arrivalAt: null, connectionVerification: "unverified" });
});
it("does not turn generic Facebook ad sources into Messenger leads", () => {
  expect(leadProvenance({ source: "facebook_ads" }).messenger).toBe(false);
  expect(leadProvenance({ source: null }).source).toBeNull();
});