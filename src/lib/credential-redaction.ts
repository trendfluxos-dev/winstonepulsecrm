/** Local-only text sanitization. Never return matches, offsets or original values. */
export function redactCredentialText(text: string): string {
  const labels = /(?:access[\s_-]*token|page[\s_-]*(?:id|token)|app[\s_-]*secret|client[\s_-]*secret|password|passwd|pwd|authorization|bearer|verify[\s_-]*token|পাসওয়ার্ড|পাসওয়ার্ড|টোকেন|পেজ\s*(?:আইডি|আই ডি))/i;
  let pending = false;
  return text.split(/\r?\n/).map((line) => {
    if (labels.test(line)) {
      // Drop the complete line: avoids leaking values in comments, URLs or JSON.
      pending = true;
      return "[REDACTED]";
    }
    if (pending && line.trim()) {
      pending = false;
      return "[REDACTED]";
    }
    return line
      .replace(/\bEAA[A-Za-z0-9_-]+\b/g, "[REDACTED]")
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]")
      .replace(/\b\d{8,}\b/g, "[REDACTED]")
      .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[REDACTED]");
  }).join("\n");
}