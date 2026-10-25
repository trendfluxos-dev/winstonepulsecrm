# Windsor.ai Facebook Ads — disconnected reporting preparation

## Inspected evidence
- `AppShell.tsx`, `NavSidebar.tsx`, `RoleGate.tsx`: scope-filtered navigation and existing authority UI gate.
- `access.server.ts`: caller resolution reads profiles/grants and maintenance state. This preparation does **not** call it or query the production DB.
- `admin-gate.server.ts`: existing full IT PIN verification is local and server-only. Configuration inspection requires that existing full scope, not HQ/LeadHub/agent tokens.
- `messenger-setup.tsx`, `messenger.functions.ts`, historical plan: preparation states are not verified provider connectivity. Messenger and `/inbox` are unchanged.
- No pre-existing Windsor adapter or confirmed Windsor API contract found. No settings/secrets/credentials inspected.
- Uploaded HTML was inspected as inert headings only: browser Page subscription, permission checks, webhook configuration, test simulator. Scripts and credential fields were not run, copied or imported. Browser-token/API simulators are not approved integration code. A pasted `/me` name/id establishes neither app approval nor reporting permissions.

## Implemented boundary
`/facebook-ads` is authority-only preparation, with no sample metrics. On-demand status inspection uses `inspectWindsorReport` with an existing full IT PIN; it reads only a configuration-presence boolean inside the handler. It always returns disconnected, an empty report and no fetched timestamp, including when configured. No provider transport exists. No background sync, exports, persistence, SQL, migrations, campaign/ad/budget actions or schema changes.

Proposed normalized report fields: date, campaign_name, impressions, clicks, spend, currency. These are **not** assumed Windsor field names. Strict calendar dates: 1–31 inclusive days; explicit requested timezone Asia/Dhaka. Provider/ad-account timezone remains unverified; mapping must not silently reinterpret account-day data as Dhaka days. Unknown fields, endpoints, account overrides and duplicate fields are refused.

## Owner prerequisites (not performed)
1. Revoke the API key previously shared in chat. Do not reuse or repeat it.
2. Verify the intended Windsor workspace and Facebook Ads reporting account with appropriate read-only permission. Do not enable campaign management for this task.
3. When ready, save a replacement in **Project Settings → Secrets** as `WINDSOR_AI_API_KEY`. Never use a VITE variable, client file, chat or committed environment file. Secret presence does not enable this scaffold.
4. Supply official Windsor documentation confirming HTTPS endpoint, authentication placement, Facebook Ads data-source selector, actual field schema/types/nulls, account scoping, date semantics, timezone, currency, pagination, row/response limits and quota/error behavior. Use a sanitized schema/example with no customer or credential values.
5. Review access to eventual account-wide reports separately; agents have not been granted ad-account analytics access. The scaffold is limited to existing authority UI/full IT PIN configuration inspection.
6. Separately authorize a server-only bounded read adapter and isolated tests after the contract is confirmed. No URL or field mapping is guessed here. Future failures must return allow-listed error categories without credential-bearing URLs or raw responses; no automatic retries, schedules, persistence or activation implied.

## Verification and limits
Isolated test commands/results and changed-file inventory are recorded in `roadmap.md`. Build/typecheck are run automatically by the project harness, not manually. Real reporting, key validity and account authorization remain unverified; no Windsor/Meta calls or production DB queries occur in this task. No deployment or secret/settings/auth/RLS change.