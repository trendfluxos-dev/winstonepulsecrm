import { describe, expect, it } from "vitest";
import { Route as BulkImport } from "@/routes/api/public/tmp-bulk-import";
import { Route as IntegrationStatus } from "@/routes/api/public/integrations/status";

type Handler = (ctx: { request: Request }) => Promise<Response> | Response;
const handlers = (route: unknown) =>
  (route as { options: { server: { handlers: Record<string, Handler> } } }).options.server.handlers;

describe("retired public paths", () => {
  it("the old bulk lead import refuses even a request carrying an import secret", async () => {
    const request = new Request("http://x/api/public/tmp-bulk-import", {
      method: "POST",
      headers: { "x-import-secret": "anything" },
      body: JSON.stringify({ rows: [{ name: "A", phone_number: "01700000000" }] }),
    });
    const res = await handlers(BulkImport).POST({ request });
    expect(res.status).toBe(410);
  });

  it("the integration status path no longer says which secrets are set", async () => {
    const res = await handlers(IntegrationStatus).GET({ request: new Request("http://x/") });
    expect(res.status).toBe(410);
    expect(await res.text()).not.toMatch(/configured|secret/i);
  });
});
