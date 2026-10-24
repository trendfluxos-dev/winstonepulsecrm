/**
 * Facebook Messenger inbox — browser-safe shared rules (foundation only).
 * Facebook is NOT connected: there is no Page token, no webhook processing and
 * no stored message. Everything shown in the UI is labelled demo sample data.
 */

export type MessengerScope = "authority" | "coordinator" | "agent" | "none";

export type MessengerView = {
  /** Can open the inbox at all. */
  canOpen: boolean;
  /** Sees only conversations assigned to them (agents). */
  ownOnly: boolean;
  /** Sees the unassigned queue (LeadHub / writable authority only). */
  canSeeUnassigned: boolean;
  /** May assign / unassign (writable authority only — LeadHub owns routing). */
  canAssign: boolean;
  /** May type replies (agent on own conversation; never read-only HQ). */
  canReply: boolean;
  readOnly: boolean;
};

/** One role rule for UI and server. Never grants anything the server does not re-check. */
export function messengerView(caller: { scope: MessengerScope; readOnly: boolean }): MessengerView {
  if (caller.scope === "none") {
    return { canOpen: false, ownOnly: true, canSeeUnassigned: false, canAssign: false, canReply: false, readOnly: true };
  }
  if (caller.scope === "authority") {
    const write = !caller.readOnly;
    return { canOpen: true, ownOnly: false, canSeeUnassigned: true, canAssign: write, canReply: false, readOnly: caller.readOnly };
  }
  // agent + legacy coordinator accounts work as agents: own conversations only.
  return { canOpen: true, ownOnly: true, canSeeUnassigned: false, canAssign: false, canReply: !caller.readOnly, readOnly: caller.readOnly };
}

export type DemoThread = {
  id: string;
  customer: string;
  preview: string;
  assignedTo: "me" | "other" | null;
  unread: number;
  status: "open" | "pending" | "closed";
  lastInboundMinutesAgo: number;
  messages: { from: "customer" | "agent"; text: string; minutesAgo: number }[];
};

/** 24-hour standard messaging window from the customer's last message. */
export const MESSAGING_WINDOW_MINUTES = 24 * 60;
export function withinMessagingWindow(lastInboundMinutesAgo: number) {
  return lastInboundMinutesAgo >= 0 && lastInboundMinutesAgo < MESSAGING_WINDOW_MINUTES;
}

/** Demo-only samples. Never persisted, never sent anywhere, always labelled. */
export const DEMO_THREADS: readonly DemoThread[] = [
  {
    id: "demo-1", customer: "নমুনা ক্রেতা ১", preview: "প্লটের দাম জানতে চাই", assignedTo: "me", unread: 2, status: "open",
    lastInboundMinutesAgo: 12,
    messages: [
      { from: "customer", text: "আসসালামু আলাইকুম, প্লটের দাম জানতে চাই।", minutesAgo: 14 },
      { from: "customer", text: "সাইট ভিজিট কবে করা যাবে?", minutesAgo: 12 },
    ],
  },
  {
    id: "demo-2", customer: "নমুনা ক্রেতা ২", preview: "ধন্যবাদ, পরে জানাব", assignedTo: "me", unread: 0, status: "pending",
    lastInboundMinutesAgo: 60 * 30,
    messages: [
      { from: "customer", text: "ব্রোশিওর পাঠাবেন?", minutesAgo: 60 * 31 },
      { from: "agent", text: "অবশ্যই, পাঠিয়ে দিচ্ছি।", minutesAgo: 60 * 30.5 },
      { from: "customer", text: "ধন্যবাদ, পরে জানাব।", minutesAgo: 60 * 30 },
    ],
  },
  {
    id: "demo-3", customer: "নমুনা ক্রেতা ৩", preview: "কিস্তির সুবিধা আছে?", assignedTo: null, unread: 1, status: "open",
    lastInboundMinutesAgo: 5,
    messages: [{ from: "customer", text: "কিস্তির সুবিধা আছে?", minutesAgo: 5 }],
  },
  {
    id: "demo-4", customer: "নমুনা ক্রেতা ৪", preview: "লোকেশন পাঠান", assignedTo: "other", unread: 0, status: "open",
    lastInboundMinutesAgo: 90,
    messages: [{ from: "customer", text: "লোকেশন পাঠান প্লিজ।", minutesAgo: 90 }],
  },
];

/** Which demo threads a role sees — the same scoping the real inbox must use. */
export function visibleThreads(view: MessengerView, threads: readonly DemoThread[] = DEMO_THREADS) {
  if (!view.canOpen) return [];
  if (view.ownOnly) return threads.filter((t) => t.assignedTo === "me");
  return threads.slice();
}
export function unassignedThreads(view: MessengerView, threads: readonly DemoThread[] = DEMO_THREADS) {
  return view.canSeeUnassigned ? threads.filter((t) => t.assignedTo === null) : [];
}

/** Filters only after role scoping; searching never widens ownership. */
export function filterDemoThreads(view: MessengerView, options: { queue: "mine" | "unassigned"; search: string; status: "all" | DemoThread["status"] }, threads: readonly DemoThread[] = DEMO_THREADS) {
  const scoped = options.queue === "unassigned" ? unassignedThreads(view, threads) : visibleThreads(view, threads);
  const search = options.search.trim().toLocaleLowerCase();
  return scoped.filter((thread) => (options.status === "all" || thread.status === options.status) && (!search || `${thread.customer} ${thread.preview}`.toLocaleLowerCase().includes(search)));
}

export const NOT_CONNECTED = {
  code: "FACEBOOK_NOT_CONNECTED",
  bn: "Facebook এখনও সংযুক্ত হয়নি",
  en: "Facebook not connected yet",
} as const;
