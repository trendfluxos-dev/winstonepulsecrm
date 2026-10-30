# GitHub connection diagnosis and repair

## Current state (checked just now)

- **Git sync:** connected to `trendfluxos-dev/winstone-pulse-crm`, branch `main`. Lovable's code and GitHub `main` are on the same commit, `176768d1f318...`. Nothing has diverged, and `main` is the only branch. The repair below doesn't touch Git sync.
- **GitHub connections in this workspace:**

| Connection | Signs in as | Linked to this project | Can see the repo |
|---|---|---|---|
| TrendFlux's GitHub API | winstonedigital-maker | yes (the app reads this one) | no (404) |
| TrendFlux's GitHub API (2) | trendfluxos-dev (owner) | yes (stored under a second name the app never reads) | yes |
| TrendFlux's GitHub API (1) | winstonedigital-maker | no | no (404) |

## Root cause

The old failure is fixed: connection (2) now signs in as the repository owner. But two GitHub connections are linked to this project, and the app's build, activity, repository status and Search panels all read the credential from the **first** one, `TrendFlux's GitHub API`. That one is still winstonedigital-maker, so every panel gets "not found" and shows the warning. The working trendfluxos-dev credential is stored under a different name that no code reads.

Side note: the booking-failure alert target, `Winstone-BD/winstone-os`, can't be reached from either account. That was already true and isn't part of this fix.

## Repair (shortest safe path, no code or data changes)

1. Unlink `TrendFlux's GitHub API` (winstonedigital-maker) from this project only. The workspace connection stays and can be linked again later.
2. Re-link `TrendFlux's GitHub API (2)` so its credential takes the name the app reads.
3. Check that it worked: read the repository and the latest build run with the app's own credential and confirm both come back successfully, signed in as trendfluxos-dev. No builds are triggered.
4. Optional cleanup, done by you in the workspace's connector settings: delete the unused `TrendFlux's GitHub API (1)` (winstonedigital-maker) so it can't be picked by mistake again.

If step 2 still files the credential under the second name, the fallback is a one-line change in `src/lib/github-status.server.ts` so the app reads that name. That fallback needs your approval because it edits code.

## Not in scope

No new repository, no Git sync changes, no publishing, no database changes, no APK builds, and no token values shown.
