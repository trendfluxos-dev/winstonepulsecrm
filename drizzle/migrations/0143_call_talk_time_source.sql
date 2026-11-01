ALTER TABLE public.call_recordings
  ADD COLUMN IF NOT EXISTS talk_time_source text
  CHECK (talk_time_source IS NULL OR talk_time_source IN ('call_log'));
COMMENT ON COLUMN public.call_recordings.talk_time_source IS
  'Where duration_seconds came from when the phone proved it: call_log = Android CallLog.DURATION matched by the app (2.22+ behaviour). NULL = not proven (e.g. app 2.21 live dial-to-hang-up time, which includes ringing).';