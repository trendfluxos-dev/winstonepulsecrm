export function recordingEvidence(row: { storage_path: string | null; upload_status: string; file_size_bytes: number | null }) {
  if (row.storage_path && row.upload_status === "uploaded" && (row.file_size_bytes ?? 0) > 0) return "upload_recorded";
  if (row.storage_path) return "file_reference_only";
  return "no_file_recorded";
}
export function summaryEvidence(row: { analysis_status: string; ai_summary: string | null }) {
  if (row.ai_summary?.trim()) return "saved";
  if (row.analysis_status === "processing") return "processing";
  if (row.analysis_status === "failed") return "failed";
  return "not_saved";
}