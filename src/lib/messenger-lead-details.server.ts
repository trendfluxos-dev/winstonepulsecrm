import { leadOwnerId } from "@/lib/lead-access.server";
import type { MessengerLeadDetails } from "@/lib/messenger-lead-details";

type Caller = { scope: "authority" | "coordinator" | "agent" | "none"; profile?: { id: string } | null };
type Message = { lead_id: string | null; created_at: string; messenger_threads: { assigned_agent_id: string | null } | null };
type Lead = { name: string; phone_number: string; address: string | null; source: string | null; status: string;
  temperature: string | null; grade: string | null; assigned_to: string | null; assigned_agent_id: string | null };
type Store = { message: (id: string) => Promise<Message | null>; lead: (id: string) => Promise<Lead | null> };
export type MessengerLeadDetailResult = { ok: true; lead: MessengerLeadDetails } | { ok: false; code: "DISCONNECTED" | "UNAVAILABLE" | "UNLINKED" };

/** A saved message is the only lookup key; thread access never implies lead access. */
export async function readMessengerLinkedLead(caller: Caller, connected: boolean, messageId: string, store: Store): Promise<MessengerLeadDetailResult> {
  if (!connected) return { ok: false, code: "DISCONNECTED" };
  if (caller.scope === "none") return { ok: false, code: "UNAVAILABLE" };
  const message = await store.message(messageId);
  if (!message?.messenger_threads) return { ok: false, code: "UNAVAILABLE" };
  const ownOnly = caller.scope !== "authority";
  if (ownOnly && (!caller.profile?.id || message.messenger_threads.assigned_agent_id !== caller.profile.id)) return { ok: false, code: "UNAVAILABLE" };
  if (!message.lead_id) return { ok: false, code: "UNLINKED" };
  const lead = await store.lead(message.lead_id);
  if (!lead || (ownOnly && leadOwnerId(lead) !== caller.profile?.id)) return { ok: false, code: "UNAVAILABLE" };
  return { ok: true, lead: { name: lead.name, phone: lead.phone_number, address: lead.address, source: lead.source,
    status: lead.status, temperature: lead.temperature, grade: lead.grade, arrivedAt: message.created_at } };
}

export async function messengerLeadDetailStore(): Promise<Store> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return {
    message: async (id) => {
      const { data, error } = await supabaseAdmin.from("messenger_messages" as never)
        .select("lead_id, created_at, messenger_threads(assigned_agent_id)").eq("id", id).eq("direction", "inbound").maybeSingle();
      if (error) throw new Error("UNAVAILABLE");
      return data as unknown as Message | null;
    },
    lead: async (id) => {
      const { data, error } = await supabaseAdmin.from("leads")
        .select("name, phone_number, address, source, status, temperature, grade, assigned_to, assigned_agent_id").eq("id", id).maybeSingle();
      if (error) throw new Error("UNAVAILABLE");
      return data as Lead | null;
    },
  };
}