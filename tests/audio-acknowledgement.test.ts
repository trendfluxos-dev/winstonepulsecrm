import { describe, expect, it } from "vitest";
import { uploadConfirmed } from "@/lib/call-reconciliation";

describe("durable audio release requires server confirmation", () => {
  it("accepts only matching stored-audio acknowledgement", () => {
    expect(uploadConfirmed({ recording_id: "r", upload_status: "uploaded", checksum: "hash" }, "hash")).toBe(true);
  });
  it("rejects blank identity and missing checksum rather than deleting the original", () => {
    expect(uploadConfirmed({ recording_id: " ", upload_status: "uploaded", checksum: "hash" }, "hash")).toBe(false);
    expect(uploadConfirmed({ recording_id: "r", upload_status: "uploaded", checksum: "" }, "")).toBe(false);
    expect(uploadConfirmed({ recording_id: "r", upload_status: "uploaded" }, "hash")).toBe(false);
  });
  it("analysis or report verification is not an audio upload acknowledgement", () => {
    expect(uploadConfirmed({ recording_id: "r", upload_status: "verified", checksum: "hash" }, "hash")).toBe(false);
    expect(uploadConfirmed({ recording_id: "r", upload_status: "uploaded", checksum: "other" }, "hash")).toBe(false);
  });
});