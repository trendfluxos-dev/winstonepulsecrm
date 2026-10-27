import { createServerFn } from "@tanstack/react-start";

/**
 * Homepage "best performer of the day" board.
 *
 * Public on purpose — the entry hall is shown before sign-in — so it returns
 * only floor-level aggregates and agent display names, never phone numbers,
 * lead data or anything customer-identifying.
 */
export const topPerformerToday = createServerFn({ method: "GET" }).handler(async () => {
  const { dailyTopPerformer } = await import("@/lib/top-performer.server");
  return dailyTopPerformer();
});

/** Public history is an explicit aggregate projection, never raw source records. */
export const topPerformerOnDate = createServerFn({ method: "GET" })
  .inputValidator((input: { date: string }) => {
    if (!input || typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Invalid performance date");
    return { date: input.date };
  })
  .handler(async ({ data }) => {
    const { dailyTopPerformer } = await import("@/lib/top-performer.server");
    const board = await dailyTopPerformer(new Date(), data.date);
    const project = (agent: (typeof board.otherAgents)[number]) => ({
      agentId: agent.agentId, name: agent.name, score: agent.score,
      completed: agent.completed, reports: agent.reports, followUps: agent.followUps,
    });
    return { dateKey: board.dateKey, revealed: board.revealed, topThree: board.revealed ? board.topThree.map(project) : [], otherAgents: board.revealed ? board.otherAgents.map(project) : [] };
  });
