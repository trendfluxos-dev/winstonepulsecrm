/**
 * The ONE canonical System Manual / Client Handover document. The /manual
 * page, the HQ and IT Console reference cards and the downloadable PDF are
 * all generated from this content — never keep a second copy.
 */
export const MANUAL_VERSION = "1.4.0";
export const MANUAL_UPDATED = "2026-10-23";
export const MANUAL_PDF_PATH = "/winstone-system-manual.pdf";

export type ManualSection = { id: string; title: string; body: string[] };

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "purpose",
    title: "1. System architecture — Introduction",
    body: [
      "System architecture is the discipline of turning digital activity into an operating system.",
      "A system is not simply a website, dashboard, application, or collection of features. It is an interconnected operational infrastructure where data, workflows, automation, AI, people, permissions, and business rules work together toward measurable outcomes.",
      "Core philosophy: \"Growth is infrastructure.\"",
      "Architecture model: BUSINESS → DATA → WORKFLOWS → AUTOMATION → AI → OPERATIONS → ANALYTICS → DECISION → IMPROVEMENT.",
      "The purpose of this architecture is to reduce manual dependency, create repeatable processes, maintain a single source of truth, make every action traceable, connect people and systems, automate routine operations, keep humans in control of critical decisions, measure outcomes continuously, and scale without proportionally increasing operational complexity.",
      "Core architecture principles: 01 — System First. 02 — Composable. 03 — Auditable. 04 — Data as the Source of Truth. 05 — AI as an Operating Layer. 06 — Human Control. 07 — State Over Screens. 08 — History Is Permanent.",
      "State transitions and auditable history are the backbone. A lead is never a row on a screen; it is a state moving through a permanent, traceable path: Lead → Assigned → Contacted → Qualified → Follow-up → Opportunity → Site Visit → Booking → Revenue. Every transition is recorded with who, when and why — history is append-only and cannot be rewritten.",
      "Winstone Pulse is the operating proof of this philosophy inside the TrendFlux ecosystem: a Bengali-first, SIM-first tele-sales CRM where agents call from their own SIM through the Winstone Pulse Android app and every call, report and follow-up syncs to one central database. Agent records facts, CRM makes decisions, LeadHub owns routing. The server and database are the only source of truth; the screens only display it.",
      "Final positioning: Digital Experience → Data → Systems → AI → Operations → Ecosystem.",
      "Not a website built around a business. A system built to operate the business.",
    ],
  },
  {
    id: "roles",
    title: "2. Roles and permissions",
    body: [
      "Sales Agent — every agent account is a peer with identical permissions. An agent sees only leads assigned to them and only their own calls, follow-ups, reports and activity. This is enforced on the server, not by hiding things on screen.",
      "Executive Headquarters (HQ) — PIN-protected management view. Reviews live team and agent performance, leaderboards, call/report metrics and business analytics; global read access to leads, Lead 360 and exports; approves or holds daily accountability reviews and approves bookings. HQ does not assign leads or change system configuration.",
      "IT Console — PIN-protected technical administration: system health, integrations, account and device provisioning and approvals, releases, knowledge sources, notices, billing payment submission and audit. IT monitors accountability but cannot approve it. Only IT Console sessions can use the Winstone AI Copilot.",
      "LeadHub Nexus — separate PIN. The canonical lead database and lead operations: import, data quality and deduplication, quotas and assignment. It is the only place leads are assigned to agents — Winstone AI cannot assign leads.",
    ],
  },
  {
    id: "lifecycle",
    title: "3. Lead lifecycle",
    body: [
      "Imported → Unassigned in the canonical database → Assigned by LeadHub → Called → Reported → Follow-up scheduled (or contact closed with a reason) → Completed / Converted.",
      "Leads are never hard-deleted. Bad or duplicate rows are parked as duplicate_skipped. Imports never auto-assign.",
    ],
  },
  {
    id: "leadhub",
    title: "4. LeadHub assignment",
    body: [
      "Default daily quota is 50 leads per agent. LeadHub can set a different equal quantity for today only, a persistent daily quota, or a per-agent quantity.",
      "Assignment takes the oldest eligible unassigned leads first. A phone number that was ever assigned or worked is never re-assigned as a fresh lead. Every assignment change is recorded permanently in lead history.",
      "LeadHub is the only way a pool lead reaches an agent. Agent self-claim of unassigned leads is retired and rejected by the server; imports always land unassigned. The only exception is a new number an agent adds themself (e.g. an incoming caller), which is logged as agent-added.",
    ],
  },
  {
    id: "agent",
    title: "5. Agent daily workflow",
    body: [
      "Sign in → acknowledge the 9:05 AM briefing → open Desk › আজকের কাজ → call leads from the Android app → submit the post-call report → set follow-ups → complete due follow-ups first (overdue, Hot, Warm, Cold).",
    ],
  },
  {
    id: "report",
    title: "6. Call, report and follow-up workflow",
    body: [
      "After every call a report popup opens and the next call is blocked until it is submitted. Connected calls answer six yes/no questions; the server calculates score (max 90) and category: 0–20 Cold, 21–50 Warm, 51–90 Hot.",
      "Not-connected calls need no category; the lead returns to the retry queue.",
      "A follow-up needs a date/time and one structured reason. Rescheduling keeps the original time; every create, reschedule, completion, cancellation and status change is stored permanently with who, when and the old and new values. Follow-ups can never be deleted.",
    ],
  },
  {
    id: "reasons",
    title: "7. Mandatory reasons",
    body: [
      "Follow-up reasons: callback requested, price, project details, brochure, payment details, location, family discussion, more time, site visit interest, call later, agent to send information, other (short note).",
      "Contact-close reasons (when no further follow-up): Customer Not Interested, Information Completed, Converted / Closed, Wrong Number, Duplicate, Customer Requested No Further Contact, Other (note required). The server and the database both reject a report without a valid reason; the reason code and the Other note are stored on the report and written as a permanent 'contact_closed' event in the lead's history. Android v2.15+ uses the same reason list; older Android builds that send only a note are stored as Other with that note. The same labels appear in Lead 360, follow-up history, reports and exports.",
    ],
  },
  {
    id: "briefing",
    title: "8. 9:05 AM briefing gate",
    body: [
      "From 09:05 Asia/Dhaka each business day, an agent must acknowledge the current briefing/policy version before starting calls, submitting reports, completing/rescheduling follow-ups, triaging leads or logging WhatsApp messages. The server checks this on each of those actions from web and Android; refreshing or opening another tab cannot bypass it. Acknowledgements are stored permanently and cannot be edited. HQ and IT are not affected.",
    ],
  },
  {
    id: "lead360",
    title: "9. Lead 360 and full history",
    body: [
      "HQ › Lead 360 shows one lead's complete, permanent timeline: creation, every call (connected with duration, or not connected), customer response, next action, every follow-up set / rescheduled / completed, assignment and status changes, close reasons.",
      "History is loaded in full (page by page on the server) — no older events are hidden. The total event count is shown. Other leads that share the same normalized phone are listed as linked, never merged.",
      "Open it from HQ › Lead 360 search or the \"Lead 360 — পুরো ইতিহাস\" link on any lead.",
    ],
  },
  {
    id: "search",
    title: "10. Search and filtering",
    body: [
      "Lead 360 search: name, phone (any Bangladesh format), Lead ID, reference, source, follow-up status (upcoming/overdue/none), date range.",
      "Reports › follow-up history: agent, status, category, counts, date range, calendar day, sorting.",
    ],
  },
  {
    id: "exports",
    title: "11. Reports and exports",
    body: [
      "Agents export only their own data; HQ/IT export everything. Follow-up history exports to Excel and PDF with active filters. Lead 360 exports the full timeline to CSV (Dhaka and UTC time, generated-at time, total events) and Print/PDF. Exports contain only real saved records.",
    ],
  },
  {
    id: "integrity",
    title: "12. Data integrity and audit model",
    body: [
      "Append-only history: lead events, follow-up changes, lead state changes (assignment, status, work state, category), briefing acknowledgements and accountability reviews cannot be edited or deleted — the database rejects it. A correction is a new event.",
      "Submitted reports can only be corrected by HQ through the CRM. Actor identity always comes from the signed-in session on the server, never from the screen. Duplicate submissions are idempotent: a resubmitted report never creates a second follow-up.",
      "Every count shown for an agent is queried from that agent's own records on the server, never from a shared limited list.",
    ],
  },
  {
    id: "identity",
    title: "13. Duplicate detection and identity",
    body: [
      "Phone numbers are normalized to 8801XXXXXXXXX. One normalized phone can belong to only one canonical lead; duplicates on import are reported and skipped. Staff names hide MD/MSD/Mohammad/মোঃ prefixes (original kept privately).",
    ],
  },
  {
    id: "hqit",
    title: "14. HQ and IT Console functions",
    body: [
      "HQ: Overview, Lead 360, Follow-ups & Reports, Agent Performance, Leads & Funnel, Accountability & Tools. Daily Top 3 is announced at 5:30 PM on the home page.",
      "IT: System Health, Lead Database, Calls & Recordings, Knowledge (website + approved Drive folders), Notices & Support, Accounts & Access, App & Releases, Billing & Audit.",
    ],
  },
  {
    id: "trouble",
    title: "15. Troubleshooting and common states",
    body: [
      "\"Call blocked\" — an unfinished report or unacknowledged briefing; finish it first.",
      "\"Queue locked\" — pending work exceeded 10% of yesterday's workload; HQ must review and unlock.",
      "Numbers look low — the agent sees only their own assigned leads; HQ sees all.",
      "PIN screen reappears — the PIN session expired; enter the PIN again.",
    ],
  },
  {
    id: "security",
    title: "16. Security and privacy",
    body: [
      "PINs are verified on the server and never shown. Customer data stays in the CRM; do not share exports outside the company. Agent GPS is never uploaded. Recordings are private and access-checked.",
    ],
  },
  {
    id: "sales-intel",
    title: "16A. Sales Intelligence (Market Intelligence, Smart Pitchbook, Pitch History)",
    body: [
      "What it is: a module inside Winstone Pulse (menu: Sales Intelligence). It uses the existing canonical lead record and Lead 360 — there is no second lead list.",
      "AI Sales Brief: when an agent opens one of their own assigned leads, the brief lists requirement, location, budget, prior calls, last customer response, prior objections/pitches, current follow-up, score/category and today's objective. Every line is read from saved records and shows its source type; anything not recorded says 'রেকর্ড করা নেই'. Budget is not a stored field yet, so it always shows as not recorded.",
      "Market Intelligence: HQ/IT enter facts (Daily Market Brief, Finance / Loan, Area Price Trend, Government / Regulatory, Project / Property Fact) with value, unit, source name/URL, effective date, review and expiry date. A fact moves draft → verified → published → expired. Any edit creates a new version and sends it back to draft. The app ships with no market numbers; the fact list starts empty.",
      "Verified facts: only published facts that are not past their expiry date are used in pitches. Unverified and expired facts are labelled and excluded. Facts past their review date are still used but marked 'Review due'.",
      "Smart Pitchbook: the agent picks an objection (Price is high, Loan rate is high, Market may fall, Need to discuss with family, Not ready now, Wants more information, Comparing other projects, Wants lower budget, Location concern, Payment concern, Other). The CRM shows a recommended response, 'Why this response' (from the lead's own records) and Supporting Facts with source, dates and status. Buttons: Copy Pitch, WhatsApp, Save to Lead History, Edit / Regenerate.",
      "AI rule: Winstone AI only receives published facts plus the lead's real context. Its reply must cite fact ids, and every number in it must appear in a cited fact or the lead context. Otherwise the reply is rejected and the approved library template (or a neutral no-number fallback) is shown.",
      "WhatsApp: opens a prefilled wa.me message on the agent's phone. It is recorded as 'WhatsApp opened / message prepared' — never as sent or delivered, because the WhatsApp Business provider is not connected.",
      "Pitch History: every Copy/Edit/WhatsApp/Save creates a permanent pitch event linked to the lead, the signed-in agent, the last call report, the open follow-up, the objection, the template and the cited fact ids. Rows cannot be changed or deleted (database trigger). Retrying the same action does not create a second row. Pitch events appear in the Lead 360 timeline as 'PITCH USED'.",
      "Pitch Effectiveness: a fixed counting rule, not an AI score. For each pitch, the first later follow-up, call, site visit and booking on the same lead within the chosen window (default 14 days, 1–90) is linked. Site visit and booking count only from explicit saved report signals. The linked records are listed. This shows association, not causation.",
      "Filters and exports: lead, phone, Lead ID, agent (HQ), objection, action, outcome, project, source and date range, with page-by-page loading. CSV and Print/PDF include filters, generated time (Asia/Dhaka), data scope and document version. Agents only ever see and export their own pitch events.",
      "Who manages it: HQ/IT with the IT PIN can add, verify, publish, expire and version facts and pitch templates (Knowledge Admin). An Executive HQ view session can read everything but cannot change it. Agents use published knowledge and cannot change it.",
      "Example: A customer says the price is high. The agent opens Sales Intelligence → picks the lead → taps 'Price is high' → reviews the recommended reply and the published area-price fact it cites → taps WhatsApp. Lead 360 now shows 'PITCH USED — WhatsApp opened / message prepared' with the agent's name and time.",
    ],
  },
  {
    id: "units",
    title: "16B. Unit inventory, backup and restore",
    body: [
      "Unit Board: apartments, commercial spaces and plots with status Available, Booked, Sold or Blocked. HQ/IT (IT PIN) create and edit units; Executive HQ view sessions and agents read only. Unit codes are unique per project.",
      "Units are never deleted — the database refuses deletes. To retire a unit, mark it Blocked. Every create/edit is recorded in the audit log.",
      "Export JSON backup (HQ/IT): downloads every unit from the database with format/schema version, export time (ISO 8601), record count, status counts and a SHA-256 checksum. File name: unit-inventory-backup-YYYY-MM-DD-HHmmss.json (UTC).",
      "Import JSON backup (IT only): the server validates structure, versions, fields, statuses, duplicates, record count and recomputes the checksum; a changed file is rejected. A preview shows units to add, unchanged, conflicts, skipped and live-only. Nothing changes until you confirm.",
      "Safe merge (default): adds new units only. On a conflict the live value is kept unless you tick that unit. Full restore: needs a second confirmation; returns conflicting units to the backup state; live-only units are kept. Before any overwrite the server saves and re-verifies a snapshot of the full live inventory (append-only). If the inventory changed after the preview, the restore is refused.",
    ],
  },
  {
    id: "billing",
    title: "16C. Subscription billing formulas and dates",
    body: [
      "Currency: USD. VAT is added at 15% on the base price and shown in the total. Full OS: $46.29 + $6.94 VAT = $53.23. CRM-only: $15.79 + $2.37 VAT = $18.16. VAT is rounded to the nearest cent.",
      "Dates (Asia/Dhaka): notice from the 9th; renewal due on the 12th; grace through the 14th 23:59; lock at the 15th 00:00 if the month's payment is not verified. IT Console stays open during a lock.",
      "Payment status: IT submits the real transaction/receipt reference (month becomes PENDING); only the System Architect verifies it (month becomes PAID). The screen cannot mark a month paid by itself.",
      "Estimated call cost (Winstone AI) is an estimate from synced call minutes at a per-minute rate. Agents call from their own SIMs, so it is not a carrier bill and not the CRM subscription invoice.",
    ],
  },
  {
    id: "ai-copilot",
    title: "16D. Winstone AI Copilot",
    body: [
      "Available only to IT Console sessions (the button is hidden elsewhere; the server refuses other PINs). It can read team/agent performance and the estimated call cost.",
      "It cannot assign, reassign or change leads. Lead assignment is done only in LeadHub Nexus, which applies the daily quota, Friday rule, eligibility and audit history.",
    ],
  },
  {
    id: "known",
    title: "16E. Known limitations and pending decisions",
    body: [
      "Daily lead quota: the code default is 50 leads per agent per day (LeadHub can override). An older note of 25/day and a 15/day cap for one account is not what the system enforces; HQ must confirm before any change.",
      "Subscription fee: the system charges $46.29 + VAT ($53.23) due on the 12th. A later project note mentions $35.29 due on the 14th; this was not applied. Confirm the final amount before any change.",
      "Call recordings: the web app cannot prove a phone recorded or uploaded audio; Android/OEM recording limits apply. WhatsApp call duration is agent-typed because phones do not log it.",
      "Preview and live share one database, so live-data tests are read-only; write tests use isolated data or a separate staging backend.",
    ],
  },
  {
    id: "release",
    title: "16F. Release checklist",
    body: [
      "Before publishing: full test suite passes; build passes; security scan has no unresolved critical finding; database changes are additive and applied; no secrets in code; manual updated. After publishing: open the live entry page, check role cards and a read-only HQ view; hard-refresh if an old version shows.",
    ],
  },
  {
    id: "checklist",
    title: "17. Daily operational checklist",
    body: [
      "09:00 LeadHub confirms today's quantities. 09:05 agents acknowledge the briefing. During the day HQ watches Overview and overdue follow-ups. 12:50 and 17:30 shift summaries run automatically. 17:30 Top 3 announced. Before 18:00 HQ reviews accountability items. IT checks System Health once per day.",
    ],
  },
  {
    id: "changelog",
    title: "18. Version and changelog",
    body: [
      "1.4.0 (2026-10-23): Role definitions clarified (Executive Headquarters (HQ) = performance review; LeadHub Nexus = canonical leads and assignment; IT Console = technical administration). Winstone AI can no longer assign leads and is shown only to IT Console. Unit inventory storage, JSON backup/restore, billing formulas and known limitations documented.",
      "1.3.0 (2026-10-08): Introduction rewritten as the canonical System Architecture manifesto — core philosophy, architecture model, eight principles, state-transition backbone and TrendFlux ecosystem positioning.",
      "1.2.0 (2026-09-30): Sales Intelligence module — AI Sales Brief, Smart Pitchbook, verified Market Facts with versioning, permanent Pitch History in Lead 360, deterministic Pitch Effectiveness, filtered CSV/PDF export.",
      "1.1.0 (2026-09-30): Contact-close reason enforced in the database and written to permanent lead history; Other note stored and shown; follow-up cancel/old-new values logged and deletes blocked; agent self-claim retired; 9:05 gate on all agent actions; Lead 360 filters (source, requirement, reason, event type) with totals, paging and filtered CSV.",
      "1.0.0 (2026-09-30): Handover release — sidebar sub-pages for HQ/Desk/IT, Lead 360 with full permanent history, structured follow-up and contact-close reasons, append-only history tables, briefing gate on report submission, home-page daily Top 3.",
    ],
  },
];
