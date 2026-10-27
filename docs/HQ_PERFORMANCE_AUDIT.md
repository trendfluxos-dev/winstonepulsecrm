# Executive HQ operational count audit

## Scope and formula
The existing HQ overview and performance tabs share an operational audit over authorized snapshot rows. No new database tables, migrations, records, account edits or lead assignments are introduced.

The implementation uses transparent default weights: completed assigned leads × 2 + submitted reports × 2 + attempts × 1 + verified connected calls × 4 + completed follow-ups × 1.5. Audio availability, upload state and talk minutes contribute zero. The same formula drives the public daily result; report submission and follow-up completion use their saved timestamps. Historical views are recomputations, not immutable finalizations.

Call attempts are a union of saved call identities (actor + external call ID, otherwise row ID) and unlinked submitted report IDs. A submitted report is not independent phone proof. Connections require a phone-verified report or a completed phone event exceeding 10 seconds. Exact report/call linkage requires matching actor and lead; no fuzzy phone/time merging.

Assignment completion uses current canonical ownership, saved work_date in the selected range, and work_state=completed. A submitted report alone does not mark a lead completed. Completion percentage is completed IDs/assigned IDs × 100; absent denominator displays a dash. The saved completion timestamp is unavailable, so these are current-state cohort totals, not claimed historical completion events.

## Reconciliation and diagnostics
The audit exposes repeated row IDs, repeated call identity, missing classifications, unlinked reports, call-without-range-report, actor/lead conflicts, connection discrepancies, incomplete reports, unknown assignment dates, and roster-total differences. IDs only come from the authorized existing readers; lead/agent drills reuse existing HQ panels. Unknown or inactive actors remain in range totals and are explicitly reconciled against the active roster.

Audio diagnostics are collapsed and optional. Attempt/received/processed/failed stages overlap. Verified audio metadata requires verified sync plus storage path, checksum and positive bytes. No fresh file/playback or Wi-Fi/phone queue probe is performed. Missing recordings and late sync never establish a fault or reduce a score.

Reports/follow-ups and calls/leads show separate last-read timestamps. Refresh reloads both shared readers. Failed reads suppress performance totals rather than presenting cached values as fresh. Dates are strict calendar dates; reversed dates and ranges exceeding 400 days display an error with no totals.

## Verification and release status
- Focused regression suite: 56 checks passed, including final canonical-owner normalization.
- Automatic typecheck/build succeeded; semantic-color check and whitespace inspection passed.
- Real signed-in HQ preview: refresh, record-ID expansion, desktop/mobile and reversed date rejection exercised without writes. Observed 229 range reports/attempts; 889 assigned vs 849 active-roster assignments; 101 completed; the 40-owner mismatch is exposed, not edited. These are one read, not permanent business facts.
- Full suite: 1258 passed / 7 failed. Six read-only integration checks require an agent-scoped session; the available session is admin. One existing inventory assertion expects 60 routes while 61 exist. No new route was introduced.
- No publication requested for this change. Existing live /manual markers pass but do not prove this new implementation is live. Review blockers and explicitly publish before verifying the new audit on the live site.