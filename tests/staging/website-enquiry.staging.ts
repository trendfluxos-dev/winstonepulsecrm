/**
 * STAGING-ONLY end-to-end test: signed website enquiry → LeadHub (unassigned),
 * against a REAL isolated database through the real receiver route.
 *
 * Refuses to start unless STAGING_E2E=1, SUPABASE_URL is not the live CRM, and
 * STAGING_CONFIRM matches the staging project ref (same guard as call-flow).
 * Uses its own random signing secret in-process, so no real secret is needed.
 *
 *   STAGING_E2E=1 STAGING_CONFIRM=<staging-ref> bunx vitest run --config vitest.staging.config.ts tests/staging/website-enquiry.staging.ts
 *
 * Fixtures are labelled "[STAGING-E2E]" and stay in staging (leads are never deleted).
 */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { stagingGuard } from "./call-flow.staging";
import { canonicalBdPhone, hmacHex } from "@/lib/os-bridge";

const blocked = stagingGuard();
if (blocked) throw new Error(`[staging-e2e] ${blocked}`);

const SECRET = `staging-${randomUUID()}`;
const tag = `[STAGING-E2E] ${new Date().toISOString()}`;
const local = `019${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
const canonical = canonicalBdPhone(local)!;
const run = randomUUID().slice(0, 8);

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function postSigned(body: unknown) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = await hmacHex(SECRET, `${ts}.${raw}`);
  const { Route } = await import("@/routes/api/public/os/events");
  const handlers = (Route.options as unknown as { server: { handlers: { POST: (a: { request: Request }) => Promise<Response> } } }).server.handlers;
  const res = await handlers.POST({
    request: new Request("http://staging/api/public/os/events", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": randomUUID(), "x-winstone-signature": sig, "x-winstone-timestamp": ts },
      body: raw,
    }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const enquiry = (key: string, phone: string) => ({
  event_id: `evt-${key}`,
  event_type: "lead_ingested",
  idempotency_key: key,
  occurred_at: new Date().toISOString(),
  payload: { external_lead_id: `web-${key}`, source: "website", contact: { name: `${tag} visitor`, phone } },
});

async function leadsForPhone() {
  const db = await admin();
  const { data, error } = await db.from("leads").select("id, phone_number, assigned_to, assigned_agent_id, assignment_source").ilike("phone_number", `%${canonical.slice(-9)}%`);
  if (error) throw error;
  return data ?? [];
}

let leadId = "";
beforeAll(() => {
  process.env["CRM_BRIDGE_SECRET"] = SECRET;
});

describe("staging: signed website enquiry reaches LeadHub unassigned, no duplicates", () => {
  it("creates exactly one unassigned lead with no lead events", async () => {
    const r = await postSigned(enquiry(`stg-enq-${run}-1`, local));
    expect(r).toMatchObject({ status: 201, body: { status: "lead_created" } });
    leadId = String(r.body.lead_id);
    const rows = await leadsForPhone();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: leadId, assigned_to: null, assigned_agent_id: null, assignment_source: null });
    const db = await admin();
    const { count } = await db.from("lead_events").select("id", { count: "exact", head: true }).eq("lead_id", leadId);
    expect(count ?? 0).toBe(0);
  });

  it("a replay is ignored and a re-submission with a new key reuses the same lead", async () => {
    const body = enquiry(`stg-enq-${run}-1`, local);
    expect(await postSigned(body)).toMatchObject({ status: 409, body: { status: "duplicate_ignored" } });
    const again = await postSigned(enquiry(`stg-enq-${run}-2`, `+88${local}`));
    expect(again).toMatchObject({ status: 200, body: { status: "lead_exists", lead_id: leadId } });
    expect(await leadsForPhone()).toHaveLength(1);
  });

  it("a site-visit request from the same number attaches to that lead", async () => {
    const r = await postSigned({
      event_id: `evt-visit-${run}`,
      event_type: "site_visit.requested",
      idempotency_key: `stg-visit-${run}`,
      occurred_at: new Date().toISOString(),
      payload: { request_id: `stg-visit-${run}`, name: `${tag} visitor`, phone: local },
    });
    expect(r).toMatchObject({ status: 201, body: { status: "request_on_existing_lead", lead_id: leadId } });
    const rows = await leadsForPhone();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ assigned_to: null, assigned_agent_id: null });
  });
});
