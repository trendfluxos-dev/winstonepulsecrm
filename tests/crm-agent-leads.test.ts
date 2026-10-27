import { describe, expect, it } from "vitest";
import { readAgentLeads } from "@/lib/crm-agent-leads.server";

const me = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
type FixtureLead = { id: string; assigned_to?: string | null; assigned_agent_id?: string | null };
function fixture(rows: FixtureLead[], failPage = -1) {
  const reads: { from: number; to: number; filter: string }[] = [];
  const client = { from: () => {
    let filter = "";
    const query = {
      select: () => query,
      or: (value: string) => { filter = value; return query; },
      order: () => query,
      range: async (from: number, to: number) => {
        reads.push({ from, to, filter });
        const selected = rows.filter(r => r.assigned_to === me || r.assigned_agent_id === me);
        return from === failPage
          ? { data: null, error: { message: "read failed" } }
          : { data: selected.slice(from, to + 1), error: null };
      },
    };
    return query;
  } };
  return { client, reads };
}
describe("agent snapshot lead reads", () => {
  it("reads overlapping owner columns once, preserving legacy owner precedence", async () => {
    const f = fixture([
      { id: "both", assigned_to: me, assigned_agent_id: me },
      { id: "legacy", assigned_to: null, assigned_agent_id: me },
      { id: "primary", assigned_to: me, assigned_agent_id: other },
      { id: "foreign", assigned_to: other, assigned_agent_id: me },
    ]);
    const result = await readAgentLeads(f.client, me);
    expect(result.data?.map(r => r.id)).toEqual(["both", "legacy", "primary"]);
    expect(f.reads).toEqual([{ from: 0, to: 999, filter: `assigned_agent_id.eq.${me},assigned_to.eq.${me}` }]);
  });
  it("keeps every lead beyond the Data API 1000-row cap without duplicate transfer", async () => {
    const rows = Array.from({ length: 1201 }, (_, id) => ({ id: String(id), assigned_to: me, assigned_agent_id: me }));
    const f = fixture(rows);
    const result = await readAgentLeads(f.client, me);
    expect(result.data).toHaveLength(1201);
    expect(new Set(result.data?.map(r => r.id)).size).toBe(1201);
    expect(f.reads).toHaveLength(2);
  });
  it("fails without returning partial totals when a later page fails", async () => {
    const f = fixture(Array.from({ length: 1001 }, (_, id) => ({ id: String(id), assigned_to: me })), 1000);
    expect(await readAgentLeads(f.client, me)).toEqual({ data: null, error: { message: "read failed" } });
  });
  it("rejects non-UUID owner filters before making any query", async () => {
    const f = fixture([]);
    await expect(readAgentLeads(f.client, "invalid,assigned_to.not.is.null")).rejects.toThrow();
    expect(f.reads).toHaveLength(0);
  });
});