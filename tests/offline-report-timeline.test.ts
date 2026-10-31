import { beforeEach, describe, expect, it, vi } from "vitest";
import { offlineTimeline } from "@/lib/offline-status";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe("offline report details: queued, last attempt, server confirmation", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.stubGlobal("localStorage", new MemStorage());
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("a queued report has a queued time but no attempt and no confirmation", () => {
    const { steps, attempts } = offlineTimeline({
      id: "r1", kind: "report_submit", createdAt: "2026-10-31T05:00:00Z", status: "pending", attempts: 0, label: "Rahim", payload: {},
    });
    expect(steps.map((s) => [s.key, s.at])).toEqual([
      ["queued", "2026-10-31T05:00:00Z"], ["last_attempt", null], ["confirmed", null],
    ]);
    expect(attempts).toBe(0);
  });

  it("records the last attempt on failure and the confirmation only when the server accepts", async () => {
    vi.resetModules();
    const q = await import("@/lib/offline-queue");
    vi.useFakeTimers({ now: new Date("2026-10-31T05:00:00Z"), toFake: ["Date"] });
    q.enqueue("report_submit", "Rahim", { clientEventId: "evt-1" });
    vi.setSystemTime(new Date("2026-10-31T05:10:00Z"));
    await q.flushQueue({ call_event: async () => null, report_submit: async () => { throw new Error("network down"); } });
    const failed = q.readQueue()[0]!;
    expect(failed.lastAttemptAt).toBe("2026-10-31T05:10:00.000Z");
    expect(offlineTimeline(failed).steps[2]!.at).toBeNull();
    expect(offlineTimeline(failed).attempts).toBe(1);

    q.markPending("evt-1");
    vi.setSystemTime(new Date("2026-10-31T05:20:00Z"));
    await q.flushQueue({ call_event: async () => null, report_submit: async () => ({ ok: true }) });
    const sent = q.readSent(Date.parse("2026-10-31T05:21:00Z"))[0]!;
    const { steps, attempts } = offlineTimeline(sent);
    expect(steps.map((s) => [s.key, s.at])).toEqual([
      ["queued", "2026-10-31T05:00:00.000Z"],
      ["last_attempt", "2026-10-31T05:20:00.000Z"],
      ["confirmed", "2026-10-31T05:20:00.000Z"],
    ]);
    expect(attempts).toBe(2);
  });

  it("a refused report shows a refusal time, never a confirmation", () => {
    const { steps } = offlineTimeline({
      id: "r2", kind: "report_submit", label: "x", createdAt: "2026-10-31T05:00:00Z", sentAt: "2026-10-31T05:05:00Z", outcome: "not_accepted",
    });
    expect(steps.map((s) => s.key)).toEqual(["queued", "last_attempt", "refused"]);
  });
});
