# My Desk count reconciliation (no publish, no data changes)

## What the read-only checks show
- `getCrmSnapshot` (`src/lib/crm.functions.ts`) already scopes an agent view through `readAgentLeads(me)`, and `resolveSnapshotCaller` (preview-only fix) puts the signed-in session ahead of a stored HQ PIN. The 4,865 figure fits the live site still running the old caller order: floor data reached the desk. This fix is not published yet.
- My Desk tiles (`src/routes/desk.tsx` ~L100-175, `DeskCommandCenter.tsx` ~L533) work out "My leads", "pending", and "done" from every lead currently owned, across all time. They use `work_state === "completed"` and `status === "pending"`, so completed history inflates the totals. "Today's calls" uses `dhakaDay(created_at)` on `call_recordings` only, so submitted reports never count toward it.
- Working tree: the summary lists HQ audit files (`performance-audit.ts`, `PerformanceCountAudit.tsx`, the command-center changes) and desk files (`crm.functions.ts`, `desk.tsx`, `DeskCommandCenter.tsx`). Step 1 below re-checks that list first.

## Plan
1. **Re-check the overlap first.** Read the full diff for the files above and confirm which HQ audit changes are finished. Desk work reuses `performance-audit.ts` helpers (`rangeError`, `uniqueRows`) and leaves HQ code alone.
2. **Separate the agent's own counts from company counts on My Desk.**
   - "My active assigned leads" = leads the agent owns now (`assigned_agent_id ?? assigned_to = me`) whose `work_state` is not completed or `duplicate_skipped`. For Mehedi, an all-time total of 566 is shown as context only.
   - "Completed by me (selected period)" = leads I own with `work_state = completed` and a `work_date` in range. The label says this reflects the current state.
   - Company inventory (4,865) appears only in HQ/LeadHub, labelled "Company inventory", behind the existing role gate. It never appears on the desk.
3. **Daily distribution tile.** Show today's Dhaka count from `lead_daily_assignment_ledger` for this agent against the 50 quota, using `src/lib/allocation-ledger.server.ts` through a server function scoped to the agent. Expected value for Mehedi today: 20/50. Before building, I'll compare it with the current receipt source to explain why it shows 0.
4. **Reports, calls and connected (Today and range).** Count distinct submitted `call_reports` (where `submitted_at` is set) by the Dhaka day of `submitted_at`. Attempts = reports plus unlinked call events, deduplicated by `physicalCallKey`. "Connected" splits into "verified" and "agent-reported", with both labels shown. Audio and sync stay out of the score.
5. **Follow-ups.** Read from `current_follow_up_work_items` through `followUpWork("current")`. Due = status `upcoming`/`rescheduled` with `scheduled_at` today. Overdue = `scheduled_at` < now. Deduplicate by id. The overdue card and the count come from the same list (expected for Mehedi: 349 total, 159 overdue).
6. **Hot leads.** One shared rule in a small helper: `temperature = 'hot'` among my active assigned leads. Every desk tile and filter uses it. Grade A is shown separately and labelled.
7. **Range guard.** The desk date range uses `rangeError`. A reversed or invalid range shows an alert instead of zeros.
8. **Labels.** Every tile shows its source, scope ("Mine" or "Company") and time window ("Today, Dhaka" / "Range" / "Current").

## Files
- `src/lib/desk-counts.ts` (new, pure functions), `src/lib/crm.functions.ts` (agent snapshot adds own submitted reports, current follow-up items, today's ledger count)
- `src/routes/desk.tsx`, `src/components/crm/desk/DeskCommandCenter.tsx` (use the helper, new labels)
- `tests/desk-counts.test.ts` (new); update `tests/desk-snapshot-scope.test.ts`

## Tests (one rule each)
- Active assigned leads leave out completed and duplicate_skipped leads, and leads owned by other agents.
- Completed count uses only my leads inside the selected work_date window.
- The daily tile reads the ledger: 20 rows today gives 20/50.
- Today's reports count by submitted_at in Dhaka time; a duplicate id counts once.
- Overdue = scheduled_at < now among upcoming/rescheduled items; done items are excluded.
- Hot uses one rule across tiles.
- A reversed range gives an error, not zeros.
- A missing audio file changes no count.
- Then: full `bunx vitest run`, a type check, and a desk check in the preview browser while signed in as an agent (read-only).

## Not doing
No production row changes, no reassignment, no publish. After the build I'll report exact files, test results and publish status.
