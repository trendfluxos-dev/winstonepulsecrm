export type MessengerLeadDetails = {
  name: string; phone: string; address: string | null; source: string | null;
  status: string; temperature: string | null; grade: string | null; arrivedAt: string;
};
export function messengerLeadLookupAllowed(connected: boolean, thread: { id: string; storedMessageId?: string }) {
  return connected && !thread.id.startsWith("demo-") && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(thread.storedMessageId ?? "");
}