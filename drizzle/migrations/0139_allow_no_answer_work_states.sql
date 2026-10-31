-- Did-not-receive cadence parks leads as 'snoozed' (retry pending) or 'unresponsive'
-- (3 strikes, 7-day reactivation). The check never allowed them, so the atomic
-- report finalizer now refuses every No Answer / Busy report. Additive only:
-- every existing value stays allowed; no rows change.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_work_state_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_work_state_check
  CHECK (work_state = ANY (ARRAY['pending'::text, 'completed'::text, 'duplicate_skipped'::text, 'snoozed'::text, 'unresponsive'::text]));