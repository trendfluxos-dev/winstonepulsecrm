import { expect, it, vi } from "vitest";
import { testMetaConnection } from "@/lib/meta-connection-test.server";
const config = { appId: "123", pageId: "456", pageToken: "synthetic-page-token", appSecret: "synthetic-app-secret" };
it("missing config never calls Meta", async () => {
  const transport = vi.fn();
  expect((await testMetaConnection({}, transport)).reason).toBe("CONFIGURATION_REQUIRED");
  expect(transport).not.toHaveBeenCalled();
});
it("matched identity and subscriptions never infer permission approval or activate", async () => {
  const bodies = [{ id: "456" }, { data: [{ id: "123", subscribed_fields: ["messages"] }] }, { data: [{ object: "page", active: true, fields: [{ name: "messages" }] }] }];
  const transport = vi.fn(async () => Response.json(bodies.shift()));
  const result = await testMetaConnection(config, transport);
  expect(result).toMatchObject({ connected: false, page: "identity_verified", app: "page_association_verified", webhook: "subscriptions_verified", permissions: "unverified", reason: "APP_REVIEW_AND_PERMISSION_EVIDENCE_REQUIRED" });
  expect(JSON.stringify(result)).not.toContain("synthetic");
  for (const [url, options] of transport.mock.calls as unknown as [string, RequestInit][]) {
    expect(url).not.toMatch(/synthetic|access_token/);
    expect(options.method).toBe("GET");
    expect(options.redirect).toBe("error");
  }
});
it("provider errors containing credentials are reduced to safe codes", async () => {
  const result = await testMetaConnection(config, vi.fn(async () => Response.json({ error: { message: config.pageToken } }, { status: 403 })));
  expect(result.reason).toBe("ACCESS_REJECTED");
  expect(JSON.stringify(result)).not.toContain(config.pageToken);
});
it("wrong Page stops before subscription reads", async () => {
  const transport = vi.fn(async () => Response.json({ id: "999" }));
  expect((await testMetaConnection(config, transport)).reason).toBe("PAGE_MISMATCH");
  expect(transport).toHaveBeenCalledTimes(1);
});
it("partial lists never establish absent subscription", async () => {
  const bodies = [{ id: "456" }, { data: [], paging: { next: "https://example.invalid" } }];
  expect((await testMetaConnection(config, vi.fn(async () => Response.json(bodies.shift())))).reason).toBe("INCOMPLETE_SUBSCRIPTION_READ");
});