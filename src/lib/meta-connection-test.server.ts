import { z } from "zod";

const pageSchema = z.object({ id: z.string() });
const pageApps = z.object({ data: z.array(z.object({ id: z.string(), subscribed_fields: z.array(z.string()).optional() })).max(100), paging: z.object({ next: z.string().optional() }).optional() });
const appSubscriptions = z.object({ data: z.array(z.object({ object: z.string(), active: z.boolean().optional(), fields: z.array(z.object({ name: z.string() })).optional() })).max(100) });
export type MetaCheck = { checkedAt: string; connected: false; app: string; page: string; webhook: string; permissions: "unverified"; reason: string };

/** Bounded manual GETs only. Never include credentials or provider bodies in output/logs. */
export async function testMetaConnection(config: { appId?: string | undefined; pageId?: string | undefined; pageToken?: string | undefined; appSecret?: string | undefined }, transport: typeof fetch = fetch): Promise<MetaCheck> {
  const result: MetaCheck = { checkedAt: new Date().toISOString(), connected: false, app: "unverified", page: "unverified", webhook: "unverified", permissions: "unverified", reason: "CONFIGURATION_REQUIRED" };
  const { appId, pageId, pageToken, appSecret } = config;
  if (!appId || !pageId || !pageToken || !appSecret || !/^\d+$/.test(appId) || !/^\d+$/.test(pageId)) return result;
  async function get(path: string, bearer: string) {
    const response = await transport(`https://graph.facebook.com/v26.0/${path}`, { method: "GET", headers: { Authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(10000), redirect: "error" });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(response.status === 401 || response.status === 403 ? "ACCESS_REJECTED" : "META_CHECK_FAILED");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("INVALID_META_RESPONSE");
    let text = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 65536) { await reader.cancel(); throw new Error("INVALID_META_RESPONSE"); }
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    const body: unknown = JSON.parse(text);
    if (typeof body === "object" && body !== null && "error" in body) throw new Error("META_CHECK_FAILED");
    return body;
  }
  try {
    const page = pageSchema.parse(await get("me?fields=id", pageToken));
    if (page.id !== pageId) { result.reason = "PAGE_MISMATCH"; return result; }
    result.page = "identity_verified";
    const apps = pageApps.parse(await get(`${pageId}/subscribed_apps?fields=id,subscribed_fields&limit=100`, pageToken));
    const currentApp = apps.data.find(app => app.id === appId);
    if (!currentApp) { result.reason = apps.paging?.next ? "INCOMPLETE_SUBSCRIPTION_READ" : "PAGE_APP_NOT_SUBSCRIBED"; return result; }
    result.app = "page_association_verified";
    const subscriptions = appSubscriptions.parse(await get(`${appId}/subscriptions`, `${appId}|${appSecret}`));
    const pageSubscription = subscriptions.data.find(item => item.object === "page" && item.active === true);
    if (!currentApp.subscribed_fields?.includes("messages") || !pageSubscription?.fields?.some(field => field.name === "messages")) {
      result.reason = "MESSAGES_SUBSCRIPTION_MISSING"; return result;
    }
    result.webhook = "subscriptions_verified";
    result.reason = "APP_REVIEW_AND_PERMISSION_EVIDENCE_REQUIRED";
    // Neither API readability nor subscription establishes Live mode/Advanced Access or delivery.
    return result;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    result.reason = ["ACCESS_REJECTED", "META_CHECK_FAILED", "INVALID_META_RESPONSE"].includes(code) ? code : "META_CHECK_FAILED";
    return result;
  }
}