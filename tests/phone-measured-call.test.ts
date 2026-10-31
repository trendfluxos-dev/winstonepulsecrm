import { describe, expect, it } from "vitest";
import { isPhoneMeasuredCall, pickPhoneMeasuredCall } from "@/lib/call-duration";

describe("which calls prove talk time", () => {
  it("accepts a dialled call the phone read from its own call log", () => {
    expect(isPhoneMeasuredCall({ call_source: "android_dialer", external_call_id: "log-812-01712345678" })).toBe(true);
    expect(isPhoneMeasuredCall({ call_source: "android_incoming", external_call_id: "log-9-01812345678" })).toBe(true);
  });

  it("rejects a live dialer row whose time includes ringing", () => {
    expect(isPhoneMeasuredCall({ call_source: "android_dialer", external_call_id: "a1b2-c3" })).toBe(false);
  });

  it("keeps the app's SIM call and the phone recorder, and never a web callback", () => {
    expect(isPhoneMeasuredCall({ call_source: "android_sim" })).toBe(true);
    expect(isPhoneMeasuredCall({ call_source: "phone_recorder" })).toBe(true);
    expect(isPhoneMeasuredCall({ call_source: "web_callback", external_call_id: "log-1-0171" })).toBe(false);
  });

  it("uses the call log's 280 seconds for a report opened soon after", () => {
    const at = "2026-10-31T11:51:19Z";
    const rows = [{ created_at: at, started_at: at, duration_seconds: 280, call_source: "android_dialer" }];
    expect(pickPhoneMeasuredCall("2026-10-31T11:56:00Z", rows)?.seconds).toBe(280);
  });
});
