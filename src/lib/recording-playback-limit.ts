/** Largest stored recording the in-page player will stream (bytes). */
export const PLAYBACK_MAX_BYTES = 40 * 1024 * 1024;

/** Whole megabytes, rounded up, for the "too large" message. */
export function recordingSizeMb(sizeBytes: number): number {
  return Math.max(1, Math.ceil(sizeBytes / (1024 * 1024)));
}

export const PLAYBACK_LIMIT_MB = PLAYBACK_MAX_BYTES / (1024 * 1024);
