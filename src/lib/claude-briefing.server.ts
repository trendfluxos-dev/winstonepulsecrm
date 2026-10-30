/**
 * Calls Claude through the Lovable AI Gateway native Messages API, streamed
 * and consumed server-side. Fails closed with safe messages; provider error
 * bodies are never logged or returned.
 */
import { BRIEFING_SYSTEM, CLAUDE_BRIEFING_MODEL, type BriefingFacts } from "@/lib/claude-briefing";

export class BriefingError extends Error {}

function safeMessage(status: number): string {
  if (status === 402) return "AI credits are used up — top up in Settings → Plans & credits.";
  if (status === 403) return "Claude access is not allowed for this workspace right now.";
  if (status === 429) return "Too many AI requests — please try again in a minute.";
  if (status === 401) return "AI is not configured on the server.";
  return "Claude could not write the briefing right now — please try again later.";
}

export async function writeClaudeBriefing(facts: BriefingFacts): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new BriefingError(safeMessage(401));

  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: CLAUDE_BRIEFING_MODEL,
        max_tokens: 2000,
        stream: true,
        output_config: { effort: "low" },
        system: BRIEFING_SYSTEM,
        messages: [{ role: "user", content: `Today's floor facts (JSON):\n${JSON.stringify(facts)}` }],
      }),
    });
  } catch {
    throw new BriefingError(safeMessage(0));
  }
  if (!res.ok || !res.body) {
    console.error("claude briefing error", res.status);
    throw new BriefingError(safeMessage(res.status));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let stop: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        let evt: { type?: string; delta?: { type?: string; text?: string; stop_reason?: string }; error?: unknown };
        try { evt = JSON.parse(raw); } catch { continue; }
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") text += evt.delta.text ?? "";
        if (evt.type === "message_delta" && evt.delta?.stop_reason) stop = evt.delta.stop_reason;
        if (evt.type === "error") throw new BriefingError(safeMessage(500));
      }
    }
  }
  if (stop === "refusal") throw new BriefingError("Claude declined to write this briefing.");
  const out = text.trim();
  if (!out) throw new BriefingError(safeMessage(500));
  return out;
}
