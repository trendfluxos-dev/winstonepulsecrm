-- Additive only: two nullable columns + one partial unique index. No defaults, no backfill,
-- existing rows and values are untouched.
ALTER TABLE public.call_recordings
  ADD COLUMN IF NOT EXISTS call_log_id text,
  ADD COLUMN IF NOT EXISTS talk_time_verified_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS call_recordings_call_log_id_key
  ON public.call_recordings (call_log_id) WHERE call_log_id IS NOT NULL;
COMMENT ON COLUMN public.call_recordings.call_log_id IS
  'Android call-log row id (log-<rowId>-<tail>) whose CallLog.DURATION/type reconciled this call row. One log row reconciles at most one call row; NULL = never reconciled.';
COMMENT ON COLUMN public.call_recordings.talk_time_verified_at IS
  'When duration_seconds/call_status were set from Android call-history evidence (talk_time_source = call_log). NULL = not verified.';