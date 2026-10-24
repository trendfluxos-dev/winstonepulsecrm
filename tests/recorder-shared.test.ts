import { describe, expect, it } from "vitest";
import { extensionForMime, normaliseInsight } from "@/lib/recorder-shared";

describe("Recorder insight normalisation", () => {
  it("keeps at most 6 takeaways and 6 action items", () => {
    const many = Array.from({ length: 9 }, (_, i) => `p${i}`);
    const r = normaliseInsight({ summary: "s", takeaways: many, action_items: many });
    expect(r.takeaways).toHaveLength(6);
    expect(r.actionItems).toHaveLength(6);
  });
  it("invents nothing when the AI returns nothing", () => {
    expect(normaliseInsight(null)).toEqual({ title: "", summary: "", takeaways: [], actionItems: [] });
  });
});

describe("Recorder audio type mapping", () => {
  it("iPhone mp4 audio is saved as m4a", () => expect(extensionForMime("audio/mp4")).toBe("m4a"));
  it("Android Chrome webm stays webm", () => expect(extensionForMime("audio/webm;codecs=opus")).toBe("webm"));
});

import { voiceNoteStage } from "@/lib/recorder-shared";
describe("Voice note stage", () => {
  it("ready notes are ready", () => expect(voiceNoteStage({ status: "ready", transcript: "x" })).toBe("ready"));
  it("failed with no transcript means transcription failed", () =>
    expect(voiceNoteStage({ status: "failed", transcript: null })).toBe("transcript_failed"));
  it("failed with a transcript means only the summary failed", () =>
    expect(voiceNoteStage({ status: "failed", transcript: "hello" })).toBe("summary_failed"));
});

import { classifyMicError } from "@/lib/recorder-shared";
describe("Microphone problem detection", () => {
  it("blocked permission is 'denied'", () => expect(classifyMicError({ name: "NotAllowedError" })).toBe("denied"));
  it("no microphone is 'no_device'", () => expect(classifyMicError({ name: "NotFoundError" })).toBe("no_device"));
  it("mic used by another app is 'busy'", () => expect(classifyMicError({ name: "NotReadableError" })).toBe("busy"));
  it("anything else is 'unknown'", () => expect(classifyMicError(new Error("x"))).toBe("unknown"));
});
