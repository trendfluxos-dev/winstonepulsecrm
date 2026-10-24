/** One physical call key; upload identity is separate from recording availability. */
export type AudioEvidence = {
  id?: string;
  agent_id?: string | null;
  lead_id?: string | null;
  storage_path?: string | null;
  audio_url?: string | null;
  checksum?: string | null;
  recording_status?: string | null;
  upload_status?: string | null;
  call_status?: string | null;
};

export function audioStored(row: AudioEvidence) {
  return Boolean(row.storage_path || row.audio_url) &&
    ["uploaded", "verified", "stored"].includes(row.upload_status ?? "");
}

export function recordingAvailability(row: AudioEvidence): "available" | "pending" | "not_available" | "unknown" {
  if (audioStored(row)) return "available"; // legacy stored and current available share one read contract
  if (row.recording_status === "not_available") return "not_available";
  if (row.recording_status === "pending") return "pending";
  return "unknown";
}

export function assertAudioIdentity(row: AudioEvidence, agentId: string | null, leadId: string, checksum: string) {
  if (row.agent_id !== agentId || row.lead_id !== leadId) throw new Error("CALL_IDENTITY_CONFLICT");
  if ((row.storage_path || row.audio_url) && row.checksum !== checksum) throw new Error("AUDIO_CHECKSUM_CONFLICT");
}

export async function audioChecksum(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

const phase: Record<string, number> = { initiated: 0, ringing: 1, answered: 2, completed: 3, failed: 3, no_answer: 3 };
/** Offline replay cannot downgrade a terminal call or discard an already stored file. */
export function reconcileLifecycle(row: AudioEvidence, incoming: { call_status: string; recording_status: string }) {
  const oldPhase = phase[row.call_status ?? ""] ?? -1;
  const newPhase = phase[incoming.call_status] ?? -1;
  return {
    call_status: oldPhase >= newPhase ? row.call_status ?? incoming.call_status : incoming.call_status,
    recording_status: audioStored(row) ? "available" : incoming.recording_status,
  };
}

export function uploadConfirmed(value: { recording_id?: unknown; upload_status?: unknown; checksum?: unknown }, expectedChecksum: string) {
  return typeof value.recording_id === "string" && value.recording_id.length > 0 &&
    value.upload_status === "uploaded" && value.checksum === expectedChecksum;
}