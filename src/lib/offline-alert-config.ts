/** IT-configurable thresholds for offline call report alerts (pure rules). */
import { z } from "zod";

export const OFFLINE_ALERT_CONFIG_ID = "offline_report_alerts";
export const DEFAULT_OFFLINE_ALERTS = { syncingMinutes: 2, notSentMinutes: 15 } as const;

export const offlineAlertSchema = z
  .object({
    syncingMinutes: z.number().int().min(1).max(30),
    notSentMinutes: z.number().int().min(5).max(240),
  })
  .refine((v) => v.notSentMinutes > v.syncingMinutes, {
    message: "The not-sent time must be longer than the syncing time",
  });

export type OfflineAlertConfig = z.infer<typeof offlineAlertSchema>;

/** Saved value if valid, else the defaults — a bad row never disables alerts. */
export function readOfflineAlertConfig(raw: unknown): OfflineAlertConfig {
  const parsed = offlineAlertSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...DEFAULT_OFFLINE_ALERTS };
}
