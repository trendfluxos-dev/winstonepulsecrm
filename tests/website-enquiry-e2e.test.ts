/**
 * End-to-end (in-process) check: a SIGNED website enquiry posted to the real
 * receiver route runs through the real signature check, receipt claim,
 * canonical intake and visit-request code, and must
 *   1. land as one UNASSIGNED lead (LeadHub Nexus is the only assignment path),
 *   2. never create a second lead on replay, a re-sent enquiry with a new key,
 *      a differently formatted phone, or a site-visit request for the same number.
 *
 * Only the database is replaced by an in-memory fake, so no live rows are ever
 * written. The real-database version lives in tests/staging/website-enquiry.staging.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalBdPhone, hmacHex } from "@/lib/os-bridge";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  unique: { os_event_receipts: "idempotency_key", website_visit_requests: "hub_request_id" } as Record<string, string>,
  leadEventWrites: 0,
  pushes: 0,
}));

vi.hoisted(() => {
  /** Minimal chainable query builder covering the calls the intake path makes. */
  class Q {
    private filters: [string, unknown][] = [];
    private op: "select" | "insert" | "update" = "select";
    private payload: Row | null = null;
    private returning = false;
    private single: "one" | "maybe" | null = null;
    constructor(private table: string) {}
    private rows() { return (db.tables[this.table] ??= []); }
    select() { this.returning = true; return this; }
    insert(row: Row) { this.op = "insert"; this.payload = row; return this; }
    update(patch: Row) { this.op = "update"; this.payload = patch; return this; }
    eq(k: string, v: unknown) { this.filters.push([k, v]); return this; }
    not() { return this; }
    limit() { return this; }
    order() { return this; }
    maybeSingle() { this.single = "maybe"; return this.run(); }
    // eslint-disable-next-line unicorn/no-thenable
    then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return this.run().then(res, rej); }
    singleRow() { this.single = "one"; return this.run(); }
    private match(r: Row) { return this.filters.every(([k, v]) => r[k] === v); }
    private async run(): Promise<{ data: unknown; error: { code: string; message: string } | null }> {
      if (this.op === "insert") {
        const key = db.unique[this.table];
        if (key && this.rows().some((r) => r[key] === this.payload![key])) return { data: null, error: { code: "23505", message: "duplicate" } };
        const row = { id: `${this.table}-${this.rows().length + 1}`, ...this.payload };
        this.rows().push(row);
        return { data: this.returning ? row : null, error: null };
      }
      if (this.op === "update") {
        const hit = this.rows().filter((r) => this.match(r));
        hit.forEach((r) => Object.assign(r, this.payload));
        return { data: this.returning ? hit : null, error: null };
      }
      const hit = this.rows().filter((r) => this.match(r));
      if (this.single) return { data: hit[0] ?? null, error: null };
      return { data: hit, error: null };
    }
  }
  (Q.prototype as unknown as { single: () => unknown }).single = Q.prototype.singleRow;
  (globalThis as unknown as { __FakeQ: typeof Q }).__FakeQ = Q;
});

const findLeadByPhone = (raw: string) => {
  const want = canonicalBdPhone(raw);
  return (db.tables.leads ?? []).find((l) => canonicalBdPhone(String(l.phone_number)) === want) ?? null;
};

vi.mock("@/integrations/supabase/client.server", () => {
  const Q = (globalThis as unknown as { __FakeQ: new (t: string) => unknown }).__FakeQ;
  return {
    supabaseAdmin: {
      from: (t: string) => {
        if (t === "lead_events") db.leadEventWrites++;
        return new Q(t);
      },
      rpc: async (fn: string, args: { _raw: string }) => {
        if (fn !== "lead_phone_status") throw new Error(`unexpected rpc ${fn}`);
        const lead = findLeadByPhone(args._raw);
        return { data: [{ existing_lead_id: (lead?.id as string) ?? null }], error: null };
      },
    },
  };
});
vi.mock("@/lib/lead-eligibility.server", () => ({
  resolveLeadIdByPhone: async (raw: string) => {
    const canonical = canonicalBdPhone(raw);
    const lead = findLeadByPhone(raw);
    return { canonicalPhones: canonical ? [canonical] : [], existingLeadId: (lead?.id as string) ?? null, alreadyWorked: false };
  },
}));
vi.mock("@/lib/audit.server", () => ({ logAudit: async () => undefined }));
vi.mock("@/lib/lead-events.server", () => ({ logLeadEvent: async () => { db.leadEventWrites++; } }));
vi.mock("@/lib/push.server", () => ({ sendPush: async () => { db.pushes++; } }));

const SECRET = "website-enquiry-test-secret-0123456789";

const enquiry = (o: { key: string; phone: string; eventId?: string }) => ({
  event_id: o.eventId ?? `evt-${o.key}`,
  event_type: "lead_ingested",
  idempotency_key: o.key,
  occurred_at: "2026-10-31T12:00:00+06:00",
  payload: {
    external_lead_id: `web-${o.key}`,
    source: "website",
    contact: { name: "Website Visitor", phone: o.phone, email: "visitor@example.test", city: "Dhaka" },
    qualification: { project_interest: "Winstone Heights", budget_range: "1-2 crore" },
  },
});

async function postSigned(body: unknown, opts: { secret?: string; tamper?: boolean } = {}) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  let sig = await hmacHex(opts.secret ?? SECRET, `${ts}.${raw}`);
  if (opts.tamper) sig = sig.replace(/^./, (c) => (c === "a" ? "b" : "a"));
  const { Route } = await import("@/routes/api/public/os/events");
  const handlers = (Route.options as unknown as { server: { handlers: { POST: (a: { request: Request }) => Promise<Response> } } }).server.handlers;
  const res = await handlers.POST({
    request: new Request("http://x/api/public/os/events", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": String(Math.random()), "x-winstone-signature": sig, "x-winstone-timestamp": ts },
      body: raw,
    }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const leadCount = () => (db.tables.leads ?? []).length;

describe("signed website enquiry → LeadHub (end to end, in-memory database)", () => {
  beforeEach(() => {
    vi.stubEnv("CRM_BRIDGE_SECRET", SECRET);
    db.tables = {};
    db.leadEventWrites = 0;
    db.pushes = 0;
  });

  it("a signed enquiry creates exactly one lead, unassigned, eligible for LeadHub first assignment", async () => {
    const r = await postSigned(enquiry({ key: "web-enquiry-0001", phone: "01712345678" }));
    expect(r).toMatchObject({ status: 201, body: { ok: true, status: "lead_created" } });
    expect(leadCount()).toBe(1);
    const lead = db.tables.leads![0]!;
    expect(lead).toMatchObject({ assigned_to: null, assigned_agent_id: null, assignment_source: null, status: "pending", source: "os_website" });
    expect(r.body.lead_id).toBe(lead.id);
    // Any lead event would make the lead ineligible for first assignment.
    expect(db.leadEventWrites).toBe(0);
    expect(db.tables.os_event_receipts![0]).toMatchObject({ idempotency_key: "web-enquiry-0001", status: "processed", outcome: "lead_created", lead_id: lead.id });
  });

  it("replaying the same signed enquiry is ignored and creates no second lead", async () => {
    const body = enquiry({ key: "web-enquiry-0002", phone: "01712345678" });
    await postSigned(body);
    const replay = await postSigned(body);
    expect(replay).toMatchObject({ status: 409, body: { status: "duplicate_ignored" } });
    expect(leadCount()).toBe(1);
  });

  it("the same visitor re-submitting (new key, differently formatted phone) reuses the existing lead", async () => {
    const first = await postSigned(enquiry({ key: "web-enquiry-0003", phone: "01712345678" }));
    const again = await postSigned(enquiry({ key: "web-enquiry-0004", phone: "+880 1712-345678" }));
    expect(again).toMatchObject({ status: 200, body: { status: "lead_exists", lead_id: first.body.lead_id } });
    expect(leadCount()).toBe(1);
    expect(db.tables.leads![0]).toMatchObject({ assigned_to: null, assigned_agent_id: null });
  });

  it("a site-visit request from the same number attaches to the existing lead, not a new one", async () => {
    const first = await postSigned(enquiry({ key: "web-enquiry-0005", phone: "01712345678" }));
    const visit = await postSigned({
      event_id: "evt-visit-1",
      event_type: "site_visit.requested",
      idempotency_key: "web-visit-0001",
      occurred_at: "2026-10-31T12:05:00+06:00",
      payload: { request_id: "visit-1", name: "Website Visitor", phone: "8801712345678", project: "Winstone Heights" },
    });
    expect(visit).toMatchObject({ status: 201, body: { status: "request_on_existing_lead", lead_id: first.body.lead_id } });
    expect(leadCount()).toBe(1);
    // Unassigned lead → nobody to notify, and still nothing assigned.
    expect(db.pushes).toBe(0);
    expect(db.tables.leads![0]).toMatchObject({ assigned_to: null });
  });

  it("unsigned, wrongly signed or tampered enquiries are refused and write nothing", async () => {
    const body = enquiry({ key: "web-enquiry-0006", phone: "01812345678" });
    expect((await postSigned(body, { secret: "wrong-secret-xxxxxxxxxxxx" })).status).toBe(401);
    expect((await postSigned(body, { tamper: true })).status).toBe(401);
    expect(leadCount()).toBe(0);
    expect(db.tables.os_event_receipts ?? []).toHaveLength(0);
  });
});
