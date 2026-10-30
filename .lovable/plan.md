# Unblock connected call reports that have no AI grade

## Confirmed problem
After a connected call with no finished recording analysis, the post-call form asks the agent to pick Grade A/B/C/D, but the server deliberately ignores that pick (an earlier security fix: agents must not set their own lead grade) and then rejects the report because no grade exists. The agent is stuck on the required post-call screen.

## Fix (keeps the "agents can't set grades" rule)
- Server: for connected calls without a completed, matched AI grade, allow the report to save with grade left empty ("Pending grade") instead of rejecting it. AI grade still fills it when analysis completes; HQ can still grade. No agent-chosen grade is ever stored.
- Form: remove the agent's Grade picker requirement; show "Grade pending — set by AI analysis or HQ" when no AI grade exists, and show the AI grade read-only when it does.
- Scoring is unchanged (grade is not a score input).

## Technical details
- `src/lib/call-reports.server.ts`: pass a flag to `validateReport` so the connected-call grade check is skipped when no trusted grade exists; keep `grade = null` in the write.
- `src/components/crm/PostCallReportGate.tsx`: drop `qualifying && !grade` gate and stop sending `grade`.
- Ensure the later AI-analysis path writes `call_reports.grade` when a recording finishes (verify; add if missing).
- Tests: keep "agent's chosen grade cannot fill classification" (assert grade stays null rather than throwing); add "connected report without AI grade submits with null grade".
