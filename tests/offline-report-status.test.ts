import { beforeEach, describe, expect, it, vi } from "vitest";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

async function load() {
  vi.resetModules();
  return import("@/lib/offline-queue");
}

describe("offline call report status", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemStorage());
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("goes pending → syncing → sent, and only shows sent after the server answered", async () => {
    const q = await load();
    q.enqueue("report_submit", "Call report (Rahim)", { clientEventId: "report-1", reportId: "r1" });
    expect(q.readQueue()[0]?.status).toBe("pending");
    let seenDuringSend: string | undefined;
    await q.flushQueue({
      call_event: async () => undefined,
      report_submit: async () => {
        seenDuringSend = q.readQueue()[0]?.status;
        expect(q.readSent()).toHaveLength(0);
      },
    });
    expect(seenDuringSend).toBe("syncing");
    expect(q.readQueue()).toHaveLength(0);
    expect(q.readSent()[0]).toMatchObject({ id: "report-1", outcome: "sent", label: "Call report (Rahim)" });
  });

  it("a failed send stays on the phone as failed and is not marked sent", async () => {
    const q = await load();
    q.enqueue("report_submit", "Call report", { clientEventId: "report-2" });
    await q.flushQueue({ call_event: async () => undefined, report_submit: async () => { throw new Error("Failed to fetch"); } });
    expect(q.readQueue()[0]).toMatchObject({ status: "failed", attempts: 1 });
    expect(q.readSent()).toHaveLength(0);
  });

  it("a send interrupted by closing the page shows as pending again", async () => {
    localStorage.setItem("winstone.offline.queue.v1", JSON.stringify([{ id: "x", kind: "report_submit", createdAt: "2026-10-31T07:00:00Z", status: "syncing", attempts: 0, label: "r", payload: {} }]));
    const q = await load();
    expect(q.readQueue()[0]?.status).toBe("pending");
  });

  it("a report the server already had counts as sent; a refused one is flagged", async () => {
    const q = await load();
    q.enqueue("report_submit", "A", { clientEventId: "a" });
    q.enqueue("report_submit", "B", { clientEventId: "b" });
    await q.flushQueue({
      call_event: async () => undefined,
      report_submit: async (p) => { throw new Error(p["clientEventId"] === "a" ? "Report already submitted" : "Report not found"); },
    });
    const byId = Object.fromEntries(q.readSent().map((s) => [s.id, s.outcome]));
    expect(byId).toEqual({ a: "already_on_server", b: "not_accepted" });
  });

  it("sent history expires after 24 hours", async () => {
    const q = await load();
    q.enqueue("report_submit", "A", { clientEventId: "a" });
    await q.flushQueue({ call_event: async () => undefined, report_submit: async () => undefined });
    expect(q.readSent(Date.now() + 25 * 60 * 60 * 1000)).toHaveLength(0);
  });
});
