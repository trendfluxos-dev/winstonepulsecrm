import { dhakaDay } from "@/lib/lead-groups";
import { isOpenFollowUp } from "@/lib/follow-up-lifecycle";
import type { CcAgent, CcCall, CcFilters, CcFollowUp, CcLead, CcReport } from "@/lib/command-center";

export function rangeError(from: string, to: string): string | null {
  for (const day of [from, to]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "Enter valid start and end dates.";
    const parsed = new Date(`${day}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return "Enter valid start and end dates.";
  }
  if (from > to) return "Start date must be on or before end date.";
  if ((Date.parse(to) - Date.parse(from)) / 864e5 >= 400) return "Select a range of 400 days or fewer; no truncated totals are shown.";
  return null;
}

export function uniqueRows<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map(row => [row.id, row])).values()];
}

export type AuditInput = { leads: CcLead[]; calls: CcCall[]; reports: CcReport[]; followUps: CcFollowUp[]; agents: CcAgent[]; filters: CcFilters; now: Date };
export type AuditIssue = { kind: string; table: string; ids: string[]; explanation: string };
const owner = (lead: CcLead) => lead.assigned_agent_id ?? lead.assigned_to;
const validTime = (value: string | null | undefined) => Boolean(value && Number.isFinite(Date.parse(value)));
export const physicalCallKey = (call: CcCall) => `${call.agent_id ?? "unknown"}:${call.external_call_id ?? call.id}`;
export const operationalScore = (row: { completed: number; reports: number; calls: number; connected: number; followUps: number }) => row.completed * 2 + row.reports * 2 + row.calls + row.connected * 4 + row.followUps * 1.5;
export const SCORE_FORMULA = "Completed assigned leads × 2 + submitted reports × 2 + call attempts × 1 + verified connected calls × 4 + completed follow-ups × 1.5";

/** Pure audit over already-authorized rows. Audio presence is never an activity or score gate. */
export function auditPerformance(input: AuditInput) {
  const f = input.filters;
  const error = rangeError(f.fromDay, f.toDay);
  if (error) throw new Error(error);
  const inRange = (value: string | null | undefined) => validTime(value) && dhakaDay(value ?? "") >= f.fromDay && dhakaDay(value ?? "") <= f.toDay;
  let leads = uniqueRows(input.leads).filter(l => !f.agentId || owner(l) === f.agentId);
  if (f.source) leads = leads.filter(l => (l.source ?? "unknown").replace(/_/g, " ") === f.source);
  if (f.project) {
    const ids = new Set(input.reports.filter(r => r.requirement === f.project).map(r => r.lead_id));
    leads = leads.filter(l => ids.has(l.id));
  }
  const leadIds = new Set(leads.map(l => l.id));
  const scoped = (row: { agent_id: string | null; lead_id: string | null }) => (!f.agentId || row.agent_id === f.agentId) && (!(f.source || f.project) || Boolean(row.lead_id && leadIds.has(row.lead_id)));
  const rawReports = input.reports.filter(scoped).filter(r => inRange(r.submitted_at ?? r.created_at));
  const rawCalls = input.calls.filter(scoped).filter(c => inRange(c.started_at ?? c.created_at));
  const reports = uniqueRows(rawReports).filter(r => r.status === undefined || r.status === "submitted");
  const callRows = uniqueRows(rawCalls);
  // External call IDs are scoped to the actor; never merge different agents or guess by phone/time.
  const calls = [...new Map(callRows.map(c => [physicalCallKey(c), c])).values()];
  const callById = new Map(uniqueRows(input.calls).map(c => [c.id, c]));
  const linked = (r: CcReport) => {
    const c = r.recording_id ? callById.get(r.recording_id) : undefined;
    return c && c.agent_id === r.agent_id && c.lead_id === r.lead_id ? c : undefined;
  };
  const attempts = new Map<string, { id: string; agent_id: string | null; lead_id: string | null; connected: boolean; verified: boolean }>();
  for (const c of calls) attempts.set(`call:${physicalCallKey(c)}`, { ...c, connected: c.call_status === "completed" && (c.device_reported_duration_seconds ?? c.duration_seconds) > 10, verified: ["android_sim", "phone_recorder"].includes(c.call_source ?? "") });
  for (const r of reports) {
    const c = linked(r);
    const key = c ? `call:${physicalCallKey(c)}` : `report:${r.id}`;
    const prev = attempts.get(key);
    attempts.set(key, { id: c?.id ?? r.id, agent_id: r.agent_id, lead_id: r.lead_id, connected: Boolean(r.connected) || Boolean(prev?.connected), verified: r.connection_verified === true || Boolean(prev?.verified && prev.connected) });
  }
  const followUps = uniqueRows(input.followUps).filter(scoped);
  const doneFu = followUps.filter(x => x.status === "done" && inRange(x.completed_at));
  const dueFu = followUps.filter(x => isOpenFollowUp(x.status) && inRange(x.scheduled_at));
  const overdueFu = dueFu.filter(x => validTime(x.scheduled_at) && Date.parse(x.scheduled_at ?? "") < input.now.getTime());
  // Assignment cohort uses saved work_date, NOT lead creation time. Completion is current state, not a fabricated historical event.
  const assigned = leads.filter(l => Boolean(owner(l)) && Boolean(l.work_date && l.work_date >= f.fromDay && l.work_date <= f.toDay));
  const completed = assigned.filter(l => l.work_state === "completed");
  const rows = uniqueRows(input.agents).filter(a => !f.agentId || a.id === f.agentId).map(a => {
    const mine = [...attempts.values()].filter(c => c.agent_id === a.id);
    const myAssigned = assigned.filter(l => owner(l) === a.id);
    const myDone = completed.filter(l => owner(l) === a.id);
    const row = { ...a, calls: mine.length, connected: mine.filter(c => c.connected && c.verified).length, reportedConnected: mine.filter(c => c.connected).length, reports: reports.filter(r => r.agent_id === a.id).length, assigned: myAssigned.length, completed: myDone.length, pending: myAssigned.length - myDone.length, followUps: doneFu.filter(x => x.agent_id === a.id).length, overdue: overdueFu.filter(x => x.agent_id === a.id).length, leadIds: myAssigned.map(l => l.id) };
    return { ...row, percent: row.assigned ? Math.round(row.completed / row.assigned * 1000) / 10 : null, score: operationalScore(row) };
  }).sort((a, b) => b.score - a.score || b.completed - a.completed || a.id.localeCompare(b.id));
  const issues: AuditIssue[] = [];
  const add = (kind: string, table: string, ids: string[], explanation: string) => { if (ids.length) issues.push({ kind, table, ids: [...new Set(ids)], explanation }); };
  const duplicates = (data: { id: string }[]) => data.filter((r, i) => data.findIndex(x => x.id === r.id) !== i).map(r => r.id);
  add("Duplicate IDs", "call_reports", duplicates(rawReports), "Repeated report IDs counted once.");
  add("Duplicate IDs", "call_recordings", duplicates(rawCalls), "Repeated event IDs counted once.");
  add("Duplicate IDs", "leads", duplicates(input.leads.filter(l => leadIds.has(l.id))), "Repeated assigned lead IDs counted once.");
  add("Duplicate IDs", "follow_up_events", duplicates(input.followUps.filter(scoped)), "Repeated follow-up IDs counted once.");
  add("Duplicate call identity", "call_recordings", callRows.filter((c, i) => callRows.findIndex(x => physicalCallKey(x) === physicalCallKey(c)) !== i).map(c => c.id), "Same agent/external-call ID counted once; no fuzzy phone matching.");
  add("Unclassified reports", "call_reports", reports.filter(r => !r.category).map(r => r.id), "Submitted report has no saved classification; no classification invented.");
  add("Unlinked reports", "call_reports", reports.filter(r => !linked(r)).map(r => r.id), "No matching saved call event. Report still counts; missing sync is not a fault verdict.");
  add("Call without range report", "call_recordings", calls.filter(c => !reports.some(r => linked(r) && physicalCallKey(linked(r) ?? c) === physicalCallKey(c))).map(c => c.id), "No submitted report in this date range; cross-range submission or delayed sync requires review.");
  add("Actor/lead mismatch", "call_reports", reports.filter(r => r.recording_id && callById.has(r.recording_id) && !linked(r)).map(r => r.id), "Linked call has a different actor or lead; never merge these records.");
  add("Connection discrepancy", "call_reports", reports.filter(r => { const c = linked(r); return c && typeof r.connected === "boolean" && r.connected !== (c.call_status === "completed" && (c.device_reported_duration_seconds ?? c.duration_seconds) > 10); }).map(r => r.id), "Submitted answer and saved call outcome differ; review, do not silently replace either.");
  add("Unknown assignment date", "leads", leads.filter(l => owner(l) && !l.work_date).map(l => l.id), "Excluded from date-cohort denominator because saved work date is absent.");
  add("Unknown actor", "call_reports", reports.filter(r => !input.agents.some(a => a.id === r.agent_id)).map(r => r.id), "Range totals include this record, but it is not attributed to an active roster row.");
  add("Invalid activity timestamp", "call_reports", input.reports.filter(scoped).filter(r => !validTime(r.submitted_at ?? r.created_at)).map(r => r.id), "Cannot place record in the selected time range.");
  const totalAttempts = [...attempts.values()];
  const totals = { calls: totalAttempts.length, connected: totalAttempts.filter(c => c.connected && c.verified).length, reportedConnected: totalAttempts.filter(c => c.connected).length, reports: reports.length, assigned: assigned.length, completed: completed.length, pending: assigned.length - completed.length, overdue: overdueFu.length, followUps: doneFu.length };
  const sum = rows.reduce((n, row) => n + row.calls, 0);
  if (sum !== totals.calls) add("Roster total mismatch", "activity", totalAttempts.filter(c => !rows.some(a => a.id === c.agent_id)).map(c => c.id), `Range call total ${totals.calls}; per-agent sum ${sum}. Unknown/inactive actors remain unassigned to roster.`);
  const diagnostics = {
    eventRows: calls.length,
    attempted: calls.filter(c => c.upload_status && c.upload_status !== "pending").length,
    received: calls.filter(c => ["uploaded", "verified", "stored"].includes(c.upload_status ?? "")).length,
    processed: calls.filter(c => c.analysis_status === "completed" || c.analysis_status === "done").length,
    failed: calls.filter(c => c.upload_status === "failed" || c.sync_status === "failed").length,
    verifiedAudio: calls.filter(c => c.sync_status === "verified" && Boolean(c.storage_path) && Boolean(c.checksum) && (c.file_size_bytes ?? 0) > 0).length,
    unknownAudio: calls.filter(c => !(c.sync_status === "verified" && c.storage_path && c.checksum && (c.file_size_bytes ?? 0) > 0)).length,
  };
  return { rows, totals, issues, diagnostics, reports, calls, assigned, completed, dueFu, overdueFu, asOf: input.now.toISOString() };
}