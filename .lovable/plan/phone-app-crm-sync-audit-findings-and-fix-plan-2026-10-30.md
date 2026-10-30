# Phone app ↔ CRM sync audit: findings and fix plan

This was a read-only audit: no files, data, settings or builds were changed, and no tests were run. The findings come from reading the code. I did not query the live database or test on a real phone.

## Severity-ranked findings

### P1-1 Report submission can stop partway, and a retry won't finish it
- `src/lib/call-reports.server.ts` `submitCallReport`: the report is marked `submitted` (around lines 525-563) before the lead, classification and follow-up updates run (565-678). A retry then returns early with "already submitted" (393-401).
- Risk: if a step fails after the status changes, the lead, score or follow-up is never written, and a retry won't repair it.
- Note: the database has a `finalize_call_report_atomic` function, but this submission path doesn't use it.
- Fix: send the whole finalization through that single atomic function, or record a resumable "finalizing" state that a retry completes.

### P1-2 The workspace list and the save endpoints check ownership differently
- `src/routes/api/public/agent/workspace.ts:55-62` lists a lead to an agent if either `assigned_to` or `assigned_agent_id` matches.
- `src/lib/lead-access.server.ts:18-26` `leadHeldByOther` treats an unassigned lead, or one whose two owner fields disagree, as allowed. This means `ingest/outcome.ts:58-87` can change unassigned leads.
- `ingest/recording.ts:151-164` uses `assigned_to ?? assigned_agent_id` instead.
- Fix: use the strict `leadNotAssignedTo` check and the shared `leadOwner()` rule on every phone read and write, and reject leads whose two owner fields disagree.

### P1-3 Leads captured on the phone are assigned to the agent who captured them, outside LeadHub Nexus
- `ingest/lead.ts:51-83` together with `lead-intake.server.ts:74-93` save the new lead with `assigned_to = caller` and `assignment_source='self'`. That conflicts with the rule "imports land unassigned, assignment only via LeadHub Nexus".
- This path has no 50-lead cap check apart from the database trigger, and no Friday check.
- Fix: save phone-captured leads unassigned and let LeadHub route them. If the owner wants to keep self-capture, record it as an explicit exception.

### P1-4 The 9:05 briefing check is missing on several phone endpoints
- `agent/call-start.ts:36-56` enforces it. `ingest/lead`, `ingest/outcome` and `agent/presence` do not.
- Fix: add `requireBriefingAck` to new-activity endpoints (`lead`, `outcome`). Leave report completion and recording upload ungated, so mandatory reports can still be finished.

### P1-5 The 50-lead cap trigger only counts one of the two owner fields
- `drizzle/migrations/0121_...sql:16-21` `enforce_daily_lead_cap` reads only `assigned_to`, so an assignment written only to `assigned_agent_id` is not counted.
- Not verified: whether the live trigger matches this file.
- Fix: count the canonical owner, using whichever owner field is filled, and add a test for the legacy-field case.

### P2-1 Phone status is ignored at sign-in, and the last-seen time never updates
- `device-auth.server.ts:117-140` `resolveApiCaller` doesn't check `agent_devices.status`. The `last_seen_at` update at line 136 runs as `void builder` and is never actually sent, which explains the false "no check-in" readings.
- Fix: reject phones whose status isn't active, and actually send the last-seen update while logging any error safely.

### P2-2 The phone app calculates scores itself
- `android/.../data/LeadEvaluation.kt:8-25` and `LiveCallScreen.kt:233-373` calculate and display score and category on the phone.
- `WinstoneApi.kt:364-368` sends `temperature`/`grade` alongside the six raw answers.
- The server already re-scores, ignoring the phone's values (`call-reports.server.ts:428-435`, `lead-evaluation.ts` 15/15/10/20/20/10, bands 0-20/21-50/51-90). The phone's weights currently match the server's.
- Fix: stop sending `temperature`/`grade`. Keep the phone's score as a display-only preview, or show the score the server returns.

### P2-3 Repeated outcome uploads are counted again
- `ingest/outcome.ts:22-87` has no call ID or duplicate key, so each retry adds the notes again and adds another call attempt. The phone's upload queue (`CallSyncQueue.kt:148-160`) does retry.
- Fix: process each outcome once per call ID, or retire this endpoint in favour of `/agent/report`.

### P2-4 Phone storage and sign-out
- `AgentSession.kt:27-38,159-167` stores the phone sign-in token in plain app storage, not encrypted storage. Signing out doesn't cancel the token on the server, and each new sign-in adds another active token.
- `isSignedIn()` checks the stored employee ID, not the token (`:181`).
- Fix: store the token encrypted, cancel it on the server at sign-out, and check the token itself in `isSignedIn()`.

## Verified correct
- Sign-in identity comes from the server profile. Employee ID hints from the phone are ignored and can't widen access (`workspace.ts:38-41`, `presence.ts:49-52`).
- Only a hash of the phone sign-in token is stored on the server.
- `claimLead` is retired (`agent-desk.functions.ts:80-98`), and no such call exists on Android.
- `FIXED_DAILY_QUOTA = {}`, with a cap of 50.
- Queued audio is deleted only after the server confirms the upload checksum.
- Call-log IDs persist, and the read position is saved only after calls are queued.

## Not verified (needs access or a device)
- Which version of the cap trigger and the owner-consistency rules is installed in the live database.
- Phone checks: call detection, the background report prompt, recording capture.
- Failure-injection tests: lost acknowledgements, switching accounts with queued work.
- Decision needed from you: whether self-captured leads and uploads of earlier work should be exempt from the LeadHub and briefing rules.

## Missing tests to add along with the fixes
- Outcome ownership and duplicate handling.
- The cap when only the legacy owner field is set.
- The briefing check on `lead`/`outcome`.
- Resuming a report submission that stopped partway.
- Rejecting a phone whose status isn't active.
- The phone's report payload containing no `temperature`/`grade`.

## Suggested order
P1-2, then P1-4, P1-3 (after your decision), P1-1, P1-5, then the P2 items. Each fix comes with its regression test. Nothing gets published without your approval.
