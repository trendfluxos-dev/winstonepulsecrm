import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { messengerIngestionEnabled } from "@/lib/messenger-ingest.server";
import { notConnectedMessengerService } from "@/lib/messenger.server";
import { DEMO_THREADS, messengerView, unassignedThreads, visibleThreads, withinMessagingWindow } from "@/lib/messenger-shared";
import { Route as Webhook } from "@/routes/api/public/meta/messenger";

const agent = messengerView({ scope: "agent", readOnly: false });
const hq = messengerView({ scope: "authority", readOnly: true });
const it_ = messengerView({ scope: "authority", readOnly: false });
const anon = messengerView({ scope: "none", readOnly: true });

describe("Messenger role scoping", () => {
  it("agents see only their own conversations, no unassigned queue, cannot assign", () => {
    expect(visibleThreads(agent).every((t) => t.assignedTo === "me")).toBe(true);
    expect(visibleThreads(agent)).toHaveLength(2);
    expect(unassignedThreads(agent)).toEqual([]);
    expect(agent.canAssign).toBe(false);
    expect(agent.canReply).toBe(true);
  });
  it("read-only HQ sees everything but cannot reply or assign", () => {
    expect(visibleThreads(hq)).toHaveLength(DEMO_THREADS.length);
    expect(hq.canReply).toBe(false);
    expect(hq.canAssign).toBe(false);
  });
  it("writable authority sees unassigned queue and may assign, never replies", () => {
    expect(unassignedThreads(it_).map((t) => t.id)).toEqual(["demo-3"]);
    expect(it_.canAssign).toBe(true);
    expect(it_.canReply).toBe(false);
  });
  it("signed-out callers see nothing", () => {
    expect(anon.canOpen).toBe(false);
    expect(visibleThreads(anon)).toEqual([]);
  });
  it("24-hour window boundary", () => {
    expect(withinMessagingWindow(24 * 60 - 1)).toBe(true);
    expect(withinMessagingWindow(24 * 60)).toBe(false);
  });
});

describe("Facebook not connected", () => {
  it("service stubs refuse everything", async () => {
    expect(await notConnectedMessengerService.connection()).toEqual({ connected: false, reason: "FACEBOOK_NOT_CONNECTED" });
    expect((await notConnectedMessengerService.sendReply({ threadId: "x", text: "hi", requestId: "r" })).ok).toBe(false);
  });
  it("webhook placeholder returns 503 for GET and POST", async () => {
    const h = (Webhook.options as any).server.handlers;
    for (const m of ["GET", "POST"]) {
      const res: Response = await h[m]({ request: new Request("http://x/api/public/meta/messenger", { method: m }) });
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe("FACEBOOK_NOT_CONNECTED");
    }
  });
  it("human browser navigation goes to inbox without accepting verification", async () => {
    const h = (Webhook.options as any).server.handlers;
    const res: Response = await h.GET({ request: new Request("http://x/api/public/meta/messenger", { headers: { accept: "text/html" } }) });
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/messenger");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
  it("browser-like verification requests still fail closed without a configured verify token", async () => {
    const h = (Webhook.options as any).server.handlers;
    for (const query of ["hub.mode=subscribe&hub.challenge=123&hub.verify_token=synthetic", "hub.challenge=123", "hub.mode="]) {
      const res: Response = await h.GET({ request: new Request(`http://x/api/public/meta/messenger?${query}`, { headers: { accept: "text/html" } }) });
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe("FACEBOOK_NOT_CONNECTED");
      expect(res.headers.get("Location")).toBeNull();
    }
  });
  it("subscription handshake answers only an exact verify-token match", async () => {
    const h = (Webhook.options as any).server.handlers;
    const previous = process.env.META_WEBHOOK_VERIFY_TOKEN;
    process.env.META_WEBHOOK_VERIFY_TOKEN = "synthetic-verify-token";
    try {
      const ok: Response = await h.GET({ request: new Request("http://x/api/public/meta/messenger?hub.mode=subscribe&hub.verify_token=synthetic-verify-token&hub.challenge=123456") });
      expect(ok.status).toBe(200);
      expect(await ok.text()).toBe("123456");
      expect(ok.headers.get("Cache-Control")).toBe("no-store");

      const wrong: Response = await h.GET({ request: new Request("http://x/api/public/meta/messenger?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456") });
      expect(wrong.status).toBe(403);
      expect((await wrong.json()).code).toBe("INVALID_VERIFY_TOKEN");

      const badChallenge: Response = await h.GET({ request: new Request("http://x/api/public/meta/messenger?hub.mode=subscribe&hub.verify_token=synthetic-verify-token&hub.challenge=<script>") });
      expect(badChallenge.status).toBe(403);
    } finally {
      if (previous === undefined) delete process.env.META_WEBHOOK_VERIFY_TOKEN;
      else process.env.META_WEBHOOK_VERIFY_TOKEN = previous;
    }
  });
  it("messenger code reads no secrets, no database and makes no Meta calls", () => {
    for (const f of ["src/lib/messenger.server.ts", "src/lib/messenger-shared.ts", "src/routes/messenger.tsx", "src/components/crm/MessengerInbox.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/process\.env|supabaseAdmin|\.from\(|graph\.facebook\.com|access_token/);
    }
  });
  it("messenger lives inside the CRM: desk sections, desk tab bar and desk page embed it", () => {
    const sections = readFileSync("src/lib/page-sections.ts", "utf8");
    expect(sections).toMatch(/key: "messenger", label: "মেসেঞ্জার"/);
    const tabBar = readFileSync("src/components/crm/desk/DeskTabBar.tsx", "utf8");
    expect(tabBar).toMatch(/tab: "messenger", label: \{ bn: "মেসেঞ্জার", en: "Messenger" \}/);
    const desk = readFileSync("src/routes/desk.tsx", "utf8");
    expect(desk).toMatch(/<TabsContent value="messenger">\s*<MessengerInbox \/>/);
  });
  it("the /messenger page still keeps its own head metadata and reuses the same inbox", () => {
    const page = readFileSync("src/routes/messenger.tsx", "utf8");
    expect(page).toMatch(/createFileRoute\("\/messenger"\)/);
    expect(page).toMatch(/Messenger Inbox — Winstone Pulse/);
    expect(page).toMatch(/<MessengerInbox \/>/);
  });
  it("durable storage migration is applied and the ingestion switch still gates the webhook", () => {
    const applied = readdirSync("drizzle/migrations").filter((f) => /messenger/i.test(f));
    expect(applied).toContain("0123_messenger_durable_storage.sql");
    expect(applied).toContain("0124_messenger_message_encryption.sql");
    // Storage existing must not by itself open the pipeline: the explicit
    // server flag is still required before any real event is accepted.
    expect(messengerIngestionEnabled({})).toBe(false);
    expect(messengerIngestionEnabled({ MESSENGER_INGESTION_ENABLED: "yes" })).toBe(false);
    expect(messengerIngestionEnabled({ MESSENGER_INGESTION_ENABLED: "true" })).toBe(true);
  });
  it("demo threads are clearly labelled samples", () => {
    expect(DEMO_THREADS.every((t) => t.id.startsWith("demo-") && t.customer.startsWith("নমুনা"))).toBe(true);
  });
});
