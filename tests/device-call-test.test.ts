import { describe, expect, it } from "vitest";
import { DeviceCallTestSchema } from "@/lib/device-call-test";
const ok = { phoneModel: "Samsung A15", androidVersion: "14", permPhone: "granted", permCallLog: "granted", permMicrophone: "denied", permNotifications: "unknown", network: "wifi", callType: "whatsapp", callDetected: "yes", recording: "no", summary: "unsure" };
describe("real-call test checklist", () => {
  it("accepts a fully answered checklist", () => expect(DeviceCallTestSchema.safeParse(ok).success).toBe(true));
  it("rejects a checklist missing the recording outcome", () => { const { recording: _r, ...rest } = ok; expect(DeviceCallTestSchema.safeParse(rest).success).toBe(false); });
  it("has no lead field to change", () => expect(Object.keys(DeviceCallTestSchema.shape).some(k => k.toLowerCase().includes("lead"))).toBe(false));
});
