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
