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
