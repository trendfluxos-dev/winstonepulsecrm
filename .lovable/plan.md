# Live agent KPI dashboard and release verification

## Build
- Add a dedicated **Agent KPI dashboard** section inside Executive HQ, preserving existing HQ access. Show each active approved agent as a dashboard card, with owned/active/closed/hot leads, completed owned work, submitted reports, connected reports, distinct reported leads, and current follow-up/overdue counts.
- Reuse the shared KPI definitions and existing authorized snapshot/report feeds. Report totals show the selected Dhaka date range; current lead states stay explicitly labelled “now.” Phone-sync rows never contribute to these KPIs.
- Change the HQ pool warning to compare usable pool with the next **14 calendar days** of per-agent targets, excluding Friday and configured holidays. Show daily targets, eligible allocation days, total need and shortfall. This does not change assignment schedules or records.

## Verify and release
- Add tests for per-agent isolation, reports versus unique leads, and the 14-day warning threshold/target cap.
- Run the test suite and inspect automatic production build/typecheck results.
- Request permission to test each existing agent session; verify live Owned/Active/Closed values and report-range/breakdown against read-only database aggregates.
- Publish after a fresh security scan, then check release markers and the changed live dashboard.
- HQ PIN viewing requires a genuine unlock session. Never extract or bypass the PIN, and never manufacture a shortage by changing live data. If unavailable, clearly report that live HQ visual verification remains blocked.

## Technical approach
- Add a small pure roster KPI aggregator that delegates to `kpi-contract.ts`, and a dashboard component mounted under `/hq?s=kpis`.
- Keep the existing server-authorized HQ snapshot and shared report cache; no new customer tables, migrations or business writes.
- Put the 14-day coverage calculation in a pure tested helper consumed by the existing read-only pool-notice function.