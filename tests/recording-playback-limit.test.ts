import { describe, expect, it } from "vitest";

import {
  PLAYBACK_LIMIT_MB,
  PLAYBACK_MAX_BYTES,
  recordingSizeMb,
} from "@/lib/recording-playback-limit";

describe("recording playback size limit", () => {
  it("is 40 MB", () => {
    expect(PLAYBACK_MAX_BYTES).toBe(41_943_040);
    expect(PLAYBACK_LIMIT_MB).toBe(40);
  });

  it("rounds the reported size up to whole megabytes", () => {
    expect(recordingSizeMb(40 * 1024 * 1024 + 1)).toBe(41);
    expect(recordingSizeMb(52_428_800)).toBe(50);
  });
});
