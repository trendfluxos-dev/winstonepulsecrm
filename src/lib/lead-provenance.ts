/** Legacy leads store source/creation time, not verified Messenger arrival evidence. */
export function leadProvenance(lead: { source: string | null }) {
  const source = lead.source?.trim() || null;
  const messenger = ["messenger", "facebook_messenger"].includes(source?.toLowerCase() ?? "");
  return { source, messenger, arrivalAt: null, connectionVerification: "unverified" as const };
}