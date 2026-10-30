/** Shared, browser-safe Recorder rules. */

export const MAX_VOICE_NOTE_BYTES = 14 * 1024 * 1024;
export const MIN_VOICE_NOTE_BYTES = 2_048;

export type RecorderInsight = {
  title: string;
  summary: string;
  takeaways: string[];
  actionItems: string[];
};

function list(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, max)
    .map((item) => item.slice(0, 240));
}

/** Normalises whatever the AI returned; never invents content when fields are missing. */
export function normaliseInsight(raw: unknown): RecorderInsight {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return {
    title: text(o["title"], 120),
    summary: text(o["summary"], 1200),
    takeaways: list(o["takeaways"] ?? o["key_takeaways"], 6),
    actionItems: list(o["action_items"] ?? o["actionItems"], 6),
  };
}

/** File extension for a recorded blob type (iPhone Safari gives mp4, Android Chrome webm). */
export function extensionForMime(mime: string): "webm" | "m4a" | "ogg" | "wav" | "mp3" {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  return "mp3";
}

export function contentTypeFor(ext: string): string {
  return ext === "webm" ? "audio/webm" : ext === "m4a" ? "audio/mp4" : ext === "ogg" ? "audio/ogg" : ext === "wav" ? "audio/wav" : "audio/mpeg";
}

/** Where a saved voice note is in its pipeline: audio is saved, then transcript, then AI summary. */
export type VoiceNoteStage = "ready" | "transcript_failed" | "summary_failed";

export function voiceNoteStage(row: { status?: string | null; transcript?: string | null }): VoiceNoteStage {
  if (row.status === "ready") return "ready";
  return row.transcript && row.transcript.trim() ? "summary_failed" : "transcript_failed";
}

/** Why the microphone could not start, so the screen can show the right recovery steps. */
export type MicProblem = "unsupported" | "insecure" | "denied" | "no_device" | "busy" | "unknown";

export function classifyMicError(err: unknown): MicProblem {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no_device";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "unknown";
}

/**
 * True only when the bytes start with a known audio container signature
 * (WebM/Matroska, Ogg, MP4/M4A/3GP, WAV, MP3, AAC ADTS, AMR). A renamed
 * document or image never passes, whatever MIME type the caller claims.
 */
export function looksLikeAudio(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const ascii = (start: number, len: number) => String.fromCharCode(...bytes.slice(start, start + len));
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true; // WebM
  if (ascii(0, 4) === "OggS") return true;
  if (ascii(4, 4) === "ftyp") return true; // MP4 / M4A / 3GP
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return true;
  if (ascii(0, 3) === "ID3") return true;
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true; // MP3 / AAC frame sync
  if (ascii(0, 5) === "#!AMR") return true;
  return false;
}
