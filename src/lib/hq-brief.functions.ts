import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Executive HQ presentation. Built purely from the agents' own submitted
 * updates, so this surface never carries technical status.
 */
export const executiveBrief = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, canDispatch } = await import("@/lib/access.server");
    // Locked/expired HQ session: show the locked state instead of crashing the page.
    if (!canDispatch(await resolveCaller(data.adminToken ?? null))) return null;
    const { executiveBriefNow } = await import("@/lib/hq-brief.server");
    return executiveBriefNow();
  });

/**
 * On-demand Claude summary of today's floor for Executive HQ. Same HQ/IT gate
 * as the presentation; Claude receives aggregate counts only, never customer
 * names, phones or call summaries. Runs only when HQ presses the button.
 */
export const claudeHqBriefing = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, canDispatch } = await import("@/lib/access.server");
    if (!canDispatch(await resolveCaller(data.adminToken ?? null))) {
      return { ok: false as const, error: "Executive HQ বা IT PIN দিয়ে আনলক করুন।" };
    }
    const { executiveBriefNow } = await import("@/lib/hq-brief.server");
    const { buildBriefingFacts } = await import("@/lib/claude-briefing");
    const { writeClaudeBriefing, BriefingError } = await import("@/lib/claude-briefing.server");
    const brief = await executiveBriefNow();
    try {
      const text = await writeClaudeBriefing(buildBriefingFacts(brief.main));
      return { ok: true as const, text, generatedAtLabel: brief.generatedAtLabel };
    } catch (e) {
      return { ok: false as const, error: e instanceof BriefingError ? e.message : "Claude could not write the briefing right now." };
    }
  });
