import { z } from "zod";
const perm = z.enum(["granted", "denied", "unknown"]);
const outcome = z.enum(["yes", "no", "unsure"]);
export const DeviceCallTestSchema = z.object({
  phoneModel: z.string().trim().min(2).max(80),
  androidVersion: z.string().trim().min(1).max(20),
  appVersion: z.string().trim().max(30).optional(),
  permPhone: perm, permCallLog: perm, permMicrophone: perm, permNotifications: perm,
  network: z.enum(["wifi", "mobile_data", "offline"]),
  callType: z.enum(["sim_outgoing", "sim_incoming", "whatsapp"]),
  callDetected: outcome, recording: outcome, summary: outcome,
  notes: z.string().trim().max(500).optional(),
});
export type DeviceCallTestInput = z.infer<typeof DeviceCallTestSchema>;
