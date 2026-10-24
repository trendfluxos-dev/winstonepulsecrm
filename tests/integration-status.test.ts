import { describe, expect, it } from "vitest";
import { integrationStatus } from "@/lib/integration-status";

describe("five-service public evidence status", () => {
  it("includes exactly the five requested services without claiming verified connectivity", () => {
    const statuses = integrationStatus();
    expect(statuses.map(s => s.id)).toEqual(["messenger", "whatsapp", "windsor", "drive", "os"]);
    expect(statuses.every(s => s.state === "inactive" || s.state === "unverified")).toBe(true);
  });
  it("keeps Messenger and Windsor inactive", () => {
    expect(integrationStatus().filter(s => s.state === "inactive").map(s => s.id)).toEqual(["messenger", "windsor"]);
  });
  it("does not infer WhatsApp, Drive or OS are disconnected from missing live evidence", () => {
    const statuses = integrationStatus();
    for (const id of ["whatsapp", "drive", "os"]) expect(statuses.find(s => s.id === id)?.state).toBe("unverified");
  });
  it("never manufactures a last verification timestamp", () => {
    expect(integrationStatus().map(s => s.verifiedAt)).toEqual([null, null, null, null, null]);
  });
});