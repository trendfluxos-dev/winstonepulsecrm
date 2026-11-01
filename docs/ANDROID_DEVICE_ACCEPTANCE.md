# Winstone Pulse Agent App — real-device acceptance checklist

**Overall status: NOT DONE.** No actual agent phone run has been documented yet.
A row counts as passed only with tester name, Dhaka time and evidence (screenshot/screen recording).
CI builds, emulator runs and sandbox screenshots are never device evidence.

Internal company distribution only (not Google Play). Use only an OFFICIAL APK (package `com.winstone.connect`, signer equal to the approved
`WINSTONE_RELEASE_CERT_SHA256`, checksum matching its `.sha256` file). Never test a debug/test APK
here and record it as the official result. Use a staff test account, test leads and a second phone
you control; never call a real customer.

| Header | Value |
|---|---|
| Tester / witness | |
| Phone model / Android version / SIM | |
| APK file name, versionName (versionCode) | |
| APK SHA-256 (from `.sha256` file) | |
| Signer SHA-256 (Settings or `apksigner`) | |
| Date / start time (Dhaka) | |

| # | Area | Check | Expected | Result (Pass/Fail/NOT DONE) | Evidence |
|---|---|---|---|---|---|
| 1 | Install | `sha256sum` of downloaded APK equals the `.sha256` file | identical | NOT DONE | |
| 2 | Install | Fresh install on a phone without the app | installs, opens, shows sign-in | NOT DONE | |
| 3 | Update | Install over the previous official build | updates in place, stays signed in, pending queue kept; "package conflicts" = wrong signer, STOP | NOT DONE | |
| 4 | Install | Test app (`.test`) still installed side by side | both icons present, separate data | NOT DONE | |
| 5 | Sign-in | Sign in with test agent; 9:05 briefing ack | work blocked until briefing accepted | NOT DONE | |
| 6 | Permissions | Phone, call log, contacts, notifications, mic/audio files | each request explained; denying one shows a clear message, no crash | NOT DONE | |
| 7 | Permissions | Grant a denied permission later from Settings | queued call-log work retries and syncs | NOT DONE | |
| 8 | Recording consent | First use shows recording consent | no audio captured/picked up before agreement; declining keeps calls and reports working | NOT DONE | |
| 9 | Recording availability | Phone's own recorder on/off | ON: matching file uploads; OFF/none: nothing uploaded, no fake "Synced" | NOT DONE | |
| 10 | Outgoing call | Call a test lead ≥ 30 s | CRM: outgoing, completed, duration ±5 s of phone history, exact Dhaka time | NOT DONE | |
| 11 | Outgoing no-answer | Hang up before answer | CRM: no answer, never "connected"; FAKE LEAD blocked | NOT DONE | |
| 12 | Incoming call | Answer from second phone ≥ 30 s | CRM: incoming, completed, correct number/duration | NOT DONE | |
| 13 | Incoming unknown | Unknown number calls | enters CRM unassigned for LeadHub; not given to this agent | NOT DONE | |
| 14 | Missed / rejected | Ring out; reject | missed/no answer, duration 0, never completed | NOT DONE | |
| 15 | Call log sync | Compare 5 phone-history rows with CRM | each appears once, phone-verified label, no duplicates | NOT DONE | |
| 16 | CRM report | Connected call: six answers + A/B/C/D grade, submit | success message; report visible in CRM with submitter and attempt | NOT DONE | |
| 17 | CRM report | Rejection outcome (Not interested / Wrong number) | short report, N/A defaults, no follow-up | NOT DONE | |
| 18 | Offline | Airplane mode, make call, submit report | shows Pending; nothing lost | NOT DONE | |
| 19 | Offline + reboot | Restart offline, reconnect | uploads once; report/recording appear once | NOT DONE | |
| 20 | Background | App swiped away / screen off 15 min, battery saver on | calls still logged and sync after reopening or reconnect | NOT DONE | |
| 21 | Background | Battery optimisation prompt / manufacturer autostart (if shown) | instructions clear; behaviour recorded per brand | NOT DONE | |
| 22 | Account switch | Sign out, sign in as another test agent | previous agent's queued work not attributed to the new agent | NOT DONE | |
| 23 | Sign-out | Sign out | device token removed; next API call refused until sign-in | NOT DONE | |
| 25 | Call timing (outgoing, answered) | Note phone clock at dial, answer, hang-up; compare CRM | CRM start ≈ dial time; talk duration = phone call history duration (±5 s), not dial-to-hang-up | NOT DONE | |
| 26 | Call timing (outgoing, unanswered 30 s ring) | Let it ring 30 s, hang up | CRM must show no answer / 0 s talk; report must not be "connected"; FAKE LEAD blocked. CRM must show no answer (0 s) after a 30 s ring; record actual result | NOT DONE | |
| 27 | Call timing (incoming) | Record ring start, answer, end | answer and end times and duration match phone history | NOT DONE | |
| 28 | Dhaka display | Make a call at a known time | CRM web and phone both show the same Asia/Dhaka time | NOT DONE | |
| 29 | Duplicate prevention | Retry by toggling airplane mode during upload; resubmit report | one call row, one report, one recording in CRM | NOT DONE | |
| 31 | Call history permission off | Deny call-log permission, dial and talk 20 s | CRM shows call not verified (failed) with note; report opens as not connected; nothing claims answered | NOT DONE | |
| 30 | Agent attribution | Agent B opens CRM | Agent B cannot see Agent A's call, report or recording | NOT DONE | |
| 32 | Sync: no internet (retryable) | Airplane mode, finish a call + report | Desk shows "ইন্টারনেট নেই … / No internet — will send automatically when online"; item stays Pending; after reconnect it sends once | NOT DONE | |
| 33 | Sync: signed out (waits) | Sign out with work pending, sign back in as the same agent | "Sign in again — waiting work will send after"; work sends after sign-in, never under another agent | NOT DONE | |
| 34 | Sync: permanent refusal | IT reassigns the test lead to another agent, then the tester submits for it | Item marked Failed with "This lead is not assigned to you — contact LeadHub/IT (HTTP 403 …)"; it stops retrying | NOT DONE | |
| 35 | No duplicate history on retry | Toggle airplane mode several times while a call state and recording are sending | Lead history in the CRM shows one "call started", one "recording saved" for that call | NOT DONE | |
| 36 | Recording bound to agent | Make a call as Agent A, sign out before upload, sign in as Agent B | Recording not uploaded under B; shows "belongs to another agent"; CRM has no audio for B | NOT DONE | |
| 24 | Stability | Whole run | no crash, no wrong lead owner | NOT DONE | |

## Evidence capture rules
- Screenshot the phone's call history and the matching CRM row together for rows 10–15.
- Screen-record rows 3, 8, 16 and 19.
- Record times in Asia/Dhaka. Crop out passwords, tokens, customer names and phone numbers of real people.
- Store evidence in the IT folder and link it here; then update `docs/ANDROID_RELEASE_READINESS.md` section 4.

## Sign-off
Every row Pass with evidence → one agent pilot day → all agents. Any Fail → stop, do not distribute.

Tester signature: ________  IT approval: ________  Date (Dhaka): ________
