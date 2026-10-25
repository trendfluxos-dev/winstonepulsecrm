/**
 * Pure summarizer for Messenger webhook delivery diagnostics.
 *
 * Counts and failure codes only — never message bodies, phone numbers or
 * customer identities. Browser-safe: the server function reads the durable
 * tables and passes raw rows here; this module never touches the database.
 */

export type ReceiptRow = { received_at: string; processed_at: string | null };
export type ThreadEventRow = { action: string; created_at: string };
export type OutboxRow = { sent_mid: string | null; last_error: string | null; created_at: string };

export type DeliverySummary = {
  /** False when the durable tables cannot be read — never pretends to be empty. */
  storageReady: boolean;
  receipts: { total: number; processed: number; pending: number };
  statuses: { delivery: number; read: number; postback: number; echo: number };
  outbox: { pendingRetries: number; sent: number; failed: number };
  /** Most recent outbox failure code and time; null when none exists. */
  lastFailure: { code: string; at: string } | null;
};

export function emptyDeliverySummary(storageReady: boolean): DeliverySummary {
  return {
    storageReady,
    receipts: { total: 0, processed: 0, pending: 0 },
    statuses: { delivery: 0, read: 0, postback: 0, echo: 0 },
    outbox: { pendingRetries: 0, sent: 0, failed: 0 },
    lastFailure: null,
  };
}

export function summarizeDeliveryRows(input: {
  receipts: ReceiptRow[];
  events: ThreadEventRow[];
  outbox: OutboxRow[];
}): DeliverySummary {
  const summary = emptyDeliverySummary(true);

  summary.receipts.total = input.receipts.length;
  for (const receipt of input.receipts) {
    if (receipt.processed_at) summary.receipts.processed += 1;
    else summary.receipts.pending += 1;
  }

  for (const event of input.events) {
    if (event.action === "delivery") summary.statuses.delivery += 1;
    else if (event.action === "read") summary.statuses.read += 1;
    else if (event.action === "postback") summary.statuses.postback += 1;
    else if (event.action === "echo") summary.statuses.echo += 1;
  }

  let latestFailure: OutboxRow | null = null;
  for (const row of input.outbox) {
    if (row.sent_mid) summary.outbox.sent += 1;
    else if (row.last_error) summary.outbox.failed += 1;
    else summary.outbox.pendingRetries += 1;
    if (row.last_error && (!latestFailure || row.created_at > latestFailure.created_at)) latestFailure = row;
  }
  if (latestFailure) summary.lastFailure = { code: latestFailure.last_error!, at: latestFailure.created_at };

  return summary;
}
