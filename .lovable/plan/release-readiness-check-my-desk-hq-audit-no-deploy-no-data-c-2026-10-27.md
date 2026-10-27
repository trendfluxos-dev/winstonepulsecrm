# Release-readiness check: My Desk + HQ audit (no deploy, no data changes)

## Confirmed from source and data (read this turn)
- **My Desk access is decided on the server.** `resolveSnapshotCaller` (`src/lib/crm.functions.ts`) applies only when the desk asks for `view: "agent"`. In that case it uses the signed-in staff session first, through `resolveWorkCaller(null)`. The PIN is used only when nobody is signed in. Every other view still goes through `resolveCaller(token)`, so HQ/IT PIN access works as before.
- **Agent rows are filtered on the server.** `readAgentLeads(me)` plus `filterAssignedActivity` remove other agents' rows before anything reaches the browser. The labels are wording only, not the access control.
- **HQ feed** (`command-center.functions.ts`): `resolveCaller` rejects `none`, and agent scope is limited to the agent's own assigned leads. The audit lists record IDs (`PerformanceCountAudit.tsx`) built only from rows this feed already returned to the caller. An agent can therefore only ever see IDs of their own rows. The page is also behind the HQ `RoleGate`.
- **"Today: 0 assigned" is correct for the current Dhaka day.** It is now 28 October in Dhaka. Mehedi's 20 assignment records are dated 27 October, and 28 October has none yet. The desk card reads the right record, so no change is needed.
- **My Desk tiles** now use `src/lib/desk-counts.ts`: active, completed by work date, the follow-up list, and one rule for hot leads. Submitted reports and current follow-ups come from `src/lib/desk-work.functions.ts`, which accepts agents only and reads only.

## Steps
1. **Review the diff** for `crm.functions.ts`, `desk.tsx`, `DeskCommandCenter.tsx`, `desk-counts.ts`, `desk-work.functions.ts`, `performance-audit.ts`, `PerformanceCountAudit.tsx`, `SalesCommandCenter.tsx`, `hq.tsx`, `top-performer.server.ts` and `tests/route-role-access.test.ts`. Remove imports left unused by the 4-card desk (`Timer`, `Flame`, `formatTalkTime` if unused).
2. **Access tests.** Add to `tests/desk-snapshot-scope.test.ts`:
   - A request without `view: "agent"` still uses the PIN path.
   - `getDeskWork` refuses PIN-only and authority callers.
3. **route-role-access assertion.** Open the failing expectation from earlier and compare it with the current route gate. Update it only if the gate's behaviour actually changed by design; otherwise fix the code, not the test.
4. **Run** the focused tests (desk-counts, desk-snapshot-scope, performance-audit, command-center, top-performer*, route-role-access), then `tsgo`, the full `bunx vitest run`, and check the build log.
5. **Preview check (read-only).** Using the existing staff session on /desk at 428px, confirm:
   - the 4 cards render;
   - numbers are the agent's own (not 4,865);
   - follow-up overdue matches the card;
   - /hq audit opens, and a reversed date range shows an alert.
6. **Report** the exact files, test counts, any open blockers, and "not published".

## Not doing
No publish, no production row edits, no reassignment, no new scoring weights beyond what already exists.
