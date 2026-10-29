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
export type CompatDevice = { id: string; manufacturer: string | null; model: string | null; android_version: string | null; recording_capable: boolean | null; recording_tested: boolean | null };
export type CompatCall = { device_id: string | null; storage_path: string | null; upload_status: string; file_size_bytes: number | null; analysis_status: string; ai_summary: string | null };
export type CompatRow = { key: string; manufacturer: string; model: string; androidVersion: string; devices: number; reportedCapable: number; reportedTested: number; callsDetected: number; recordingsUploaded: number; summariesSaved: number; summariesFailed: number; recordingRate: number | null; summaryRate: number | null };

/** Groups phones by manufacturer + model + Android version. Detection = a call row synced from that
 * phone; recording = confirmed upload; summary = saved AI summary. Rates are null without calls. */
export function buildCompatibilityReport(devices: CompatDevice[], calls: CompatCall[]): CompatRow[] {
  const byDevice = new Map<string, string>();
  const rows = new Map<string, CompatRow>();
  for (const d of devices) {
    const manufacturer = d.manufacturer?.trim() || "Unknown";
    const model = d.model?.trim() || "Unknown";
    const androidVersion = d.android_version?.trim() || "Unknown";
    const key = `${manufacturer.toLowerCase()}|${model.toLowerCase()}|${androidVersion}`;
    byDevice.set(d.id, key);
    const row = rows.get(key) ?? { key, manufacturer, model, androidVersion, devices: 0, reportedCapable: 0, reportedTested: 0, callsDetected: 0, recordingsUploaded: 0, summariesSaved: 0, summariesFailed: 0, recordingRate: null, summaryRate: null };
    row.devices += 1;
    if (d.recording_capable) row.reportedCapable += 1;
    if (d.recording_tested) row.reportedTested += 1;
    rows.set(key, row);
  }
  for (const c of calls) {
    const row = c.device_id ? rows.get(byDevice.get(c.device_id) ?? "") : undefined;
    if (!row) continue;
    row.callsDetected += 1;
    if (recordingEvidence(c) === "upload_recorded") row.recordingsUploaded += 1;
    const s = summaryEvidence(c);
    if (s === "saved") row.summariesSaved += 1;
    if (s === "failed") row.summariesFailed += 1;
  }
  return [...rows.values()].map(r => ({
    ...r,
    recordingRate: r.callsDetected ? Math.round((r.recordingsUploaded / r.callsDetected) * 100) : null,
    summaryRate: r.recordingsUploaded ? Math.round((r.summariesSaved / r.recordingsUploaded) * 100) : null,
  })).sort((a, b) => b.callsDetected - a.callsDetected || a.key.localeCompare(b.key));
}
