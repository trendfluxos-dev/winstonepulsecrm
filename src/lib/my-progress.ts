/**
 * Agent's own daily progress, built only from counts the server already
 * scoped to the signed-in agent. Never invents a number: a missing source
 * stays null so the card can say "not available" instead of showing 0.
 */
export type MyProgressInput = {
  quota: number | null;
  received: number | null;
  pendingLeads: number | null;
  reportsToday: number | null;
  connectedToday: number | null;
};

export type MyProgress = {
  quota: number | null;
  received: number | null;
  stillToReceive: number | null;
  quotaPct: number | null;
  pendingLeads: number | null;
  reportsToday: number | null;
  connectedToday: number | null;
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0);

export function myProgress(input: MyProgressInput): MyProgress {
  const { quota, received } = input;
  const known = quota != null && received != null;
  return {
    quota,
    received,
    stillToReceive: known ? Math.max(0, quota - received) : null,
    quotaPct: known ? pct(received, quota) : null,
    pendingLeads: input.pendingLeads,
    reportsToday: input.reportsToday,
    connectedToday: input.connectedToday,
  };
}
