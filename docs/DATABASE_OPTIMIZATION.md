# Database optimization — 2026-10-29

## Recorded usage

Current project/workspace lookup, 2026-10-16 00:00 UTC through 2026-10-29 02:10:26 UTC (partial current date): 6.21406 requested credits, comprising 6.20 Build and 0.01406 AI gateway. Database instance-hours, storage GB-hours and environment attribution were not returned. This is not evidence of free database operation or cash paid. Earlier-workspace figures are not combined with this baseline.

## Health and load

Database healthy: memory 17%, disk 5%, connections 30/120, no restarts or recent exhaustion. Database size 79.6 MB, WAL 112 MB. No resize, pause or cleanup warranted. Statistics are cumulative with an unknown reset window; tuple estimates are not exact customer counts.

Top cumulative query time: agent event reads 7,800 calls / 102,332.71 ms; broad event ID paging 72 calls / 75,938.40 ms; floor lead reads 606 calls / 44,869.84 ms. Event ordering and floor ordering already have matching indexes. A current representative agent-event plan uses the existing index and takes 1.665 ms; historical averages alone do not justify duplicate indexes.

Agent ownership-union reads: 1,303 calls / 28,075.92 ms cumulative. The current plan scanned all 4,865 leads before sorting. Added owner/update/id indexes for assigned_agent_id and assigned_to only; no customer rows, policies or grants changed.

## Before/after evidence

Same reconstructed read, same representative agent chosen server-side, same 571 returned rows and 1,000-row limit:

| Measurement | Before | After |
| --- | ---: | ---: |
| Execution time | 6.032 ms | 2.966 ms |
| Shared buffer hits | 500 | 284 |
| Shared buffer reads | 0 | 6 |
| Lead access | Sequential scan | Bitmap index/heap scan |

The post-change ownership union uses the new assigned-agent index and an existing assigned-to index. The planner can choose existing indexes for other query shapes; both new indexes are present at 286,720 bytes each (560 KiB combined), with additional write-maintenance overhead. This single database-plan comparison is not an end-to-end dashboard latency benchmark or a credit-savings measurement. Warm-cache effects and normal variance apply.

Read-only post-check: 4,865 leads, zero differing ownership columns, matching pre-check. No deletion, move or backfill occurred.

## Scheduled work and freshness

15 active schedules returned. Analysis, reminders and deployment health each run every 15 minutes: 96 times/day each, 288 combined. These are potential always-active-hour drivers, not proven billed costs. Other jobs run daily, every three hours or monthly. Safe schedule metadata lacks execution history and most target details; do not infer successful delivery.

No schedules were disabled or slowed: reminder delivery and operational monitoring would change. Analysis queue wake-on-enqueue/drain behavior needs a separately verified implementation before replacing its recurring sweep. Database hours and execution history must be measured before estimating savings.

Preserved existing dashboard behavior: snapshot realtime changes coalesce over eight seconds, hidden tabs defer snapshot reloads, snapshot polling remains 180 seconds, HQ command feed 30 seconds, desk work counts 60 seconds. No scope, quota, scoring, assignment or KPI definition changes.

## Follow-up measurements

- Obtain database instance-hour and storage quantities for this workspace/project after usage catches up.
- Compare the same signed-in dashboard flow and query-volume deltas under representative load; this update verifies query plans, not authenticated page latency.
- Inspect scheduled execution history and idle active hours before proposing queue wake-up changes or less frequent health checks; preserve delivery windows and get approval for freshness changes.
- No application deployment requested or performed; additive database indexes are already applied.