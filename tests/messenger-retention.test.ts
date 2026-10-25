import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MESSENGER_RETENTION_DAYS, MESSENGER_RETENTION_NOTE, retentionCutoff } from "@/lib/messenger-retention";

describe("messenger retention policy", () => {
  it("keeps messages 90 days and delivery history 180 days", () => {
    expect(MESSENGER_RETENTION_DAYS.messages).toBe(90);
    expect(MESSENGER_RETENTION_DAYS.threadEvents).toBe(180);
    expect(MESSENGER_RETENTION_DAYS.receipts).toBe(180);
    expect(MESSENGER_RETENTION_DAYS.sentOutbox).toBe(90);
  });

  it("computes the cutoff from the window", () => {
    const now = new Date("2026-10-25T00:00:00Z");
    expect(retentionCutoff(90, now).toISOString()).toBe("2026-07-27T00:00:00.000Z");
  });

  it("the bilingual UI note matches the policy numbers", () => {
    expect(MESSENGER_RETENTION_NOTE.bn).toContain("90");
    expect(MESSENGER_RETENTION_NOTE.bn).toContain("180");
    expect(MESSENGER_RETENTION_NOTE.en).toContain("90 days");
  });

  it("the trigger exception allows deleting only expired rows, never updates", () => {
    const sql = readFileSync("drizzle/migrations/0125_messenger_retention_policy.sql", "utf8");
    expect(sql).toContain("interval '90 days'");
    expect(sql).toContain("interval '180 days'");
    expect(sql).toContain("RAISE EXCEPTION 'Messenger history is append-only'");
    // The update branch still permits only the one-time lead link.
    expect(sql).toContain("OLD.lead_id IS NULL AND NEW.lead_id IS NOT NULL");
  });

  it("the cleanup route is cron-authenticated and never deletes pending retries", () => {
    const route = readFileSync("src/routes/api/public/jobs/messenger-retention.ts", "utf8");
    expect(route).toContain("authenticateCronRequest");
    expect(route).toContain('q.not("sent_mid", "is", null)');
    expect(route).not.toMatch(/body|psid/i.test(route) && /select.*body/i.test(route) ? /./ : /never/);
  });
});
