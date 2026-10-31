import { describe, expect, it } from "vitest";

import { callEvidence, callTimeLabel, phoneLogMissing, summarizeEvidence } from "@/lib/call-evidence";
import { agentKpiRows } from "@/lib/agent-kpi-board";

describe("call evidence — is a reported call really connected?", () => {
  it("phone call log with talk time is phone-verified", () => {
    expect(callEvidence({ connected: true, connection_verified: true, duration_source: "phone_sync", duration_seconds: 95 })).toBe("phone_verified");
  });
  it("connected with a web timer or typed time is agent-reported only", () => {
    expect(callEvidence({ connected: true, connection_verified: false, duration_source: "web_timer", duration_seconds: 120 })).toBe("reported_only");
    expect(callEvidence({ connected: true, connection_verified: false, duration_source: "entered", duration_seconds: 60 })).toBe("reported_only");
  });
  it("agent says connected but phone log shows 0s → mismatch", () => {
    expect(callEvidence({ connected: true, connection_verified: false, duration_source: "phone_sync", duration_seconds: 0 })).toBe("phone_no_talk");
  });
  it("phone log shows a real talk (>10s) but agent said not received → mismatch", () => {
    expect(callEvidence({ connected: false, duration_source: "phone_sync", duration_seconds: 45 })).toBe("phone_talk_unreported");
    expect(callEvidence({ connected: false, duration_source: "phone_sync", duration_seconds: 8 })).toBe("not_connected");
  });
  it("summary counts each kind and only phone-proven talk time", () => {
    const s = summarizeEvidence([
      { connected: true, connection_verified: true, duration_source: "phone_sync", duration_seconds: 90 },
      { connected: true, duration_source: "web_timer", duration_seconds: 300 },
      { connected: false, duration_source: "web_timer", duration_seconds: 0 },
      { connected: true, duration_source: "phone_sync", duration_seconds: 0 },
    ]);
    expect(s).toEqual({ reports: 4, phoneVerified: 1, reportedOnly: 1, notConnected: 1, mismatch: 1, phoneLogged: 2, verifiedTalkSeconds: 90 });
    expect(phoneLogMissing(s)).toBe(false);
    expect(phoneLogMissing(summarizeEvidence([{ connected: true, duration_source: "web_timer", duration_seconds: 60 }]))).toBe(true);
  });
  it("call time is shown in Dhaka time with talk length", () => {
    expect(callTimeLabel({ call_ended_at: "2026-10-31T10:15:12Z", duration_seconds: 192 })).toBe("4:12 PM – 4:15 PM · 3m 12s");
    expect(callTimeLabel({ call_ended_at: null })).toBeNull();
  });
  it("executive board evidence uses the selected Dhaka day and dedupes report ids", () => {
    const report = { id: "r1", agent_id: "a1", lead_id: "l1", submitted_at: "2026-10-31T05:00:00Z", connected: true, connection_verified: true, duration_source: "phone_sync", duration_seconds: 40 };
    const old = { ...report, id: "r2", submitted_at: "2026-10-29T05:00:00Z" };
    const [row] = agentKpiRows([{ id: "a1", name: "A" }], [], [report, report, old], [], { from: "2026-10-31", to: "2026-10-31" }, new Date("2026-10-31T06:00:00Z"));
    expect(row.evidence.reports).toBe(1);
    expect(row.evidence.phoneVerified).toBe(1);
  });
});
