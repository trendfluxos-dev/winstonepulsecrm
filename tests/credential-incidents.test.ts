import { describe, expect, it } from "vitest";

import {
  CREDENTIAL_INCIDENT_STATUSES,
  CREDENTIAL_SERVICES,
  latestPerService,
  validateIncidentNote,
  type CredentialIncident,
} from "@/lib/credential-incidents";

describe("validateIncidentNote — never stores credential material", () => {
  it("accepts a plain status description", () => {
    const result = validateIncidentNote("পুরোনো token Meta dashboard-এ revoke করা হয়েছে");
    expect(result).toEqual({ ok: true, note: "পুরোনো token Meta dashboard-এ revoke করা হয়েছে" });
  });

  it("rejects short and overlong notes", () => {
    expect(validateIncidentNote("short").ok).toBe(false);
    expect(validateIncidentNote("x".repeat(501)).ok).toBe(false);
  });

  it("rejects notes that contain credential-like values", () => {
    // A long token-looking string must never reach the database.
    const tokenLike = `token was EAA${"a".repeat(60)} before revocation`;
    expect(validateIncidentNote(tokenLike)).toEqual({ ok: false, code: "NOTE_CONTAINS_CREDENTIAL" });
  });
});

describe("latestPerService", () => {
  const record = (service: string, status: string, at: string): CredentialIncident => ({
    id: `${service}-${at}`,
    service: service as CredentialIncident["service"],
    status: status as CredentialIncident["status"],
    note: "synthetic test note",
    actorLabel: null,
    createdAt: at,
  });

  it("keeps only the newest record per service", () => {
    const latest = latestPerService([
      record("meta_page_token", "exposed", "2026-10-20T00:00:00Z"),
      record("meta_page_token", "revoked", "2026-10-24T00:00:00Z"),
      record("model_api_key", "replaced", "2026-10-23T00:00:00Z"),
    ]);
    expect(latest.get("meta_page_token")?.status).toBe("revoked");
    expect(latest.get("model_api_key")?.status).toBe("replaced");
    expect(latest.size).toBe(2);
  });
});

describe("catalogues", () => {
  it("every service and status has both languages", () => {
    for (const item of [...CREDENTIAL_SERVICES, ...CREDENTIAL_INCIDENT_STATUSES]) {
      expect(item.label.bn.length).toBeGreaterThan(0);
      expect(item.label.en.length).toBeGreaterThan(0);
    }
  });
});
