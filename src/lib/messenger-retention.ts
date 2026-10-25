/**
 * Retention policy for Messenger data. Browser-safe constants shared by the
 * scheduled cleanup route and the inbox UI, so the page and the job can never
 * disagree about how long data is kept.
 *
 * Rows newer than the window stay immutable (the append-only trigger still
 * blocks their deletion); only the scheduled cleanup may remove expired rows.
 */

export const MESSENGER_RETENTION_DAYS = {
  /** Encrypted message bodies. */
  messages: 90,
  /** Delivery/read/postback thread events. */
  threadEvents: 180,
  /** Webhook receipts (idempotency evidence). */
  receipts: 180,
  /** Successfully sent outbox rows; pending retries are never deleted. */
  sentOutbox: 90,
} as const;

export const MESSENGER_RETENTION_NOTE = {
  bn: `মেসেজ ${MESSENGER_RETENTION_DAYS.messages} দিন, ডেলিভারি ইতিহাস ${MESSENGER_RETENTION_DAYS.threadEvents} দিন সংরক্ষিত থাকে; এরপর স্বয়ংক্রিয়ভাবে মুছে যায়। সাম্প্রতিক ইতিহাস কেউ বদলাতে বা মুছতে পারে না।`,
  en: `Messages are kept ${MESSENGER_RETENTION_DAYS.messages} days, delivery history ${MESSENGER_RETENTION_DAYS.threadEvents} days, then deleted automatically. Recent history cannot be edited or deleted by anyone.`,
} as const;

/** Cutoff instant for a retention window; pure and testable. */
export function retentionCutoff(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
