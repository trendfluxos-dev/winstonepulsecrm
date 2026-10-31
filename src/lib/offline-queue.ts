/**
 * Honest offline queue for the web CRM.
 *
 * Anything an agent does with no internet (a call attempt, an outcome, a report)
 * is kept here in the browser with a client-generated event id and shown as
 * "Saved offline / pending sync" — never as if it reached the server. When the
 * connection returns the queue is replayed in the order it was created against
 * the same server functions the online path uses; the event id makes a retry
 * idempotent, so a no-answer attempt and a later callback stay two separate CRM
 * events and nothing is duplicated.
 *
 * Storage is localStorage (small, synchronous, survives reload) — no new
 * dependency and no schema of its own.
 */
const KEY = "winstone.offline.queue.v1";

export type OfflineItemKind = "call_event" | "report_submit";

export type OfflineItem = {
  id: string;
  kind: OfflineItemKind;
  createdAt: string;
  /** pending = waiting to send · syncing = being sent now · failed = last send failed. */
  status: "pending" | "syncing" | "failed";
  attempts: number;
  /** When this phone last started sending it (set before the server answers). */
  lastAttemptAt?: string | null;
  lastError?: string | null;
  label: string;
  payload: Record<string, unknown>;
};

type Listener = (items: OfflineItem[]) => void;

const listeners = new Set<Listener>();
let flushing = false;

export function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readQueue(): OfflineItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as OfflineItem[]) : [];
    if (!Array.isArray(parsed)) return [];
    // A send interrupted by a reload/closed tab never got an answer: it is pending again.
    return flushing
      ? parsed
      : parsed.map((item) => (item.status === "syncing" ? { ...item, status: "pending" } : item));
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full / private mode — nothing else we can honestly do */
  }
  listeners.forEach((listener) => listener(items));
}

/* ---------- Server-confirmed history (device-local, last 24h, max 20) ---------- */

const SENT_KEY = "winstone.offline.sent.v1";
const SENT_TTL_MS = 24 * 60 * 60 * 1000;

export type SentItem = {
  id: string;
  kind: OfflineItemKind;
  label: string;
  createdAt: string;
  sentAt: string;
  /** sent = the server accepted it now · already_on_server = it had it already · not_accepted = the server refused it for good. */
  outcome: "sent" | "already_on_server" | "not_accepted";
  note?: string | null;
  /** Send tries including the one the server answered. */
  attempts?: number;
  lastAttemptAt?: string | null;
};

type SentListener = (items: SentItem[]) => void;
const sentListeners = new Set<SentListener>();

export function readSent(now = Date.now()): SentItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]") as SentItem[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => now - Date.parse(item.sentAt) < SENT_TTL_MS)
      : [];
  } catch {
    return [];
  }
}

function writeSent(items: SentItem[]) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(items));
  } catch {
    /* storage full / private mode */
  }
  sentListeners.forEach((listener) => listener(items));
}

function recordSent(item: OfflineItem, outcome: SentItem["outcome"], note?: string) {
  const current = readQueue().find((q) => q.id === item.id) ?? item;
  const entry: SentItem = {
    attempts: (current.attempts ?? 0) + 1,
    lastAttemptAt: current.lastAttemptAt ?? null,
    id: item.id,
    kind: item.kind,
    label: item.label,
    createdAt: item.createdAt,
    sentAt: new Date().toISOString(),
    outcome,
    note: note ?? null,
  };
  writeSent([entry, ...readSent().filter((s) => s.id !== item.id)].slice(0, 20));
}

export function clearSent() {
  writeSent([]);
}

export function subscribeSent(listener: SentListener): () => void {
  sentListeners.add(listener);
  listener(readSent());
  return () => sentListeners.delete(listener);
}

function setStatus(id: string, status: OfflineItem["status"]) {
  const at = new Date().toISOString();
  writeQueue(
    readQueue().map((item) =>
      item.id === id ? { ...item, status, ...(status === "syncing" ? { lastAttemptAt: at } : {}) } : item,
    ),
  );
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  listener(readQueue());
  return () => listeners.delete(listener);
}

export function enqueue(
  kind: OfflineItemKind,
  label: string,
  payload: Record<string, unknown>,
): OfflineItem {
  const item: OfflineItem = {
    id: String(payload["clientEventId"] ?? newEventId()),
    kind,
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
    label,
    payload,
  };
  // Same client event id twice (double tap) -> one queued item.
  const existing = readQueue();
  if (existing.some((entry) => entry.id === item.id)) return item;
  writeQueue([...existing, item]);
  return item;
}

export function removeItem(id: string) {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

export function markPending(id: string) {
  writeQueue(
    readQueue().map((item) =>
      item.id === id ? { ...item, status: "pending", lastError: null } : item,
    ),
  );
}

/** Errors that mean "the server already has this / it can never succeed". */
function isTerminal(message: string): boolean {
  return /ইতিমধ্যে|already|not found|পাওয়া যায়নি|duplicate/i.test(message);
}

function alreadyOnServer(message: string): boolean {
  return /ইতিমধ্যে|already|duplicate/i.test(message);
}

export type Senders = {
  call_event: (payload: Record<string, unknown>) => Promise<unknown>;
  report_submit: (payload: Record<string, unknown>) => Promise<unknown>;
};

/** Replays the queue oldest-first. Stops on the first network failure. */
export async function flushQueue(senders: Senders): Promise<{ synced: number; failed: number }> {
  if (flushing) return { synced: 0, failed: 0 };
  flushing = true;
  let synced = 0;
  let failed = 0;
  try {
    for (const item of readQueue().sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) break;
      try {
        setStatus(item.id, "syncing");
        await senders[item.kind](item.payload);
        recordSent(item, "sent");
        removeItem(item.id);
        synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "sync failed";
        if (isTerminal(message)) {
          recordSent(
            item,
            alreadyOnServer(message) ? "already_on_server" : "not_accepted",
            message.slice(0, 160),
          );
          removeItem(item.id);
          synced += 1;
          continue;
        }
        failed += 1;
        writeQueue(
          readQueue().map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: "failed",
                  attempts: entry.attempts + 1,
                  lastError: message.slice(0, 160),
                }
              : entry,
          ),
        );
      }
    }
  } finally {
    flushing = false;
  }
  return { synced, failed };
}
