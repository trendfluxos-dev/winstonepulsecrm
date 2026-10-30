# GitHub connection diagnosis (current state, Oct 30 20:07 Dhaka)

## Findings (checked live just now)

| Check | Result |
|---|---|
| Synced repository | trendfluxos-dev/winstone-pulse-crm (private) |
| Latest change in GitHub | 110ad51 "Added GitHub access status panel", 14:05 UTC today |
| Latest change in this project | 110ad51, same change |
| Sync state | Up to date. Nothing is missing on either side and the two copies have not split. |
| GitHub API (2), linked | Signs in as trendfluxos-dev. Owner with full access. |
| GitHub API, linked | Signs in as winstonedigital-maker. Can see the repository and save changes to it (collaborator invite accepted). |
| GitHub API (1), not linked | Signs in as winstonedigital-maker. Duplicate of the one above. |

## Root cause

Git sync is working. The old problem (the GitHub account that could not see the repository) is fixed. What is left is clutter that can look like a fault:

1. **Two GitHub connections are linked to this project.** The System page panels use only the first one. Unless that first one happens to be the trendfluxos-dev connection, they read GitHub as winstonedigital-maker. That works now, but it can't manage repository settings such as build secrets.
2. **One extra winstonedigital-maker connection** exists in the workspace and is unused.
3. Any remaining "issue" message most likely comes from an old screen or panel result shown before the invite was accepted. Pressing **Check access** / **Re-check** refreshes it.

I couldn't see which "issue" message the user is getting. If it still appears after a refresh, I need its exact text.

## Proposed repair (needs your approval, nothing done yet)

1. Unlink the winstonedigital-maker connection ("TrendFlux's GitHub API") from this project only. The trendfluxos-dev connection then becomes the one the panels use. The workspace keeps the connection.
2. Optional, done by you: delete the unused "TrendFlux's GitHub API (1)" in workspace Connectors → GitHub.
3. You: open Project settings → Git and press **Re-check**. It should show "In sync with GitHub". On the System page, unlock the IT PIN and press **Check access**.

Step 1 doesn't touch the repository, the app's code, the database, builds or publishing. If you want to keep winstonedigital-maker as the account the panels use, skip step 1. Everything already works.

## Not included
No new repository, no code changes, no deploy, no APK build, no database changes.
