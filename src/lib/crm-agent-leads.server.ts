import { leadOwner } from "./lead-owner";

type LeadRow = {
  id: string;
  assigned_to?: string | null;
  assigned_agent_id?: string | null;
  updated_at?: string | null;
};
type ReadResult = { data: LeadRow[] | null; error: { message: string } | null };
type LeadQuery = {
  select: (columns: string) => LeadQuery;
  or: (filter: string) => LeadQuery;
  order: (column: string, options?: { ascending: boolean }) => LeadQuery;
  range: (from: number, to: number) => PromiseLike<ReadResult>;
};

/** One union query, not two overlapping downloads. Ownership semantics stay unchanged. */
export async function readAgentLeads(
  client: { from: (table: "leads") => LeadQuery },
  agentId: string,
): Promise<ReadResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId)) {
    throw new Error("Invalid agent identity");
  }
  const leads = new Map<string, LeadRow>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from("leads")
      .select("*")
      .or(`assigned_agent_id.eq.${agentId},assigned_to.eq.${agentId}`)
      .order("updated_at", { ascending: false }).order("id")
      .range(from, from + 999);
    if (error) return { data: null, error };
    for (const lead of data ?? []) {
      if (leadOwner(lead) === agentId) leads.set(lead.id, lead);
    }
    if (!data || data.length < 1000) return { data: [...leads.values()], error: null };
  }
}