CREATE TABLE public.recorder_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id),
  source text NOT NULL CHECK (source IN ('call','voice')),
  recording_id uuid REFERENCES public.call_recordings(id),
  storage_path text,
  mime_type text,
  duration_seconds integer NOT NULL DEFAULT 0,
  title text,
  transcript text,
  summary text,
  takeaways jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ready',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX recorder_insights_recording_uidx ON public.recorder_insights(recording_id) WHERE recording_id IS NOT NULL;
CREATE INDEX recorder_insights_agent_idx ON public.recorder_insights(agent_id, created_at DESC);
GRANT ALL ON public.recorder_insights TO service_role;
ALTER TABLE public.recorder_insights ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.recorder_insights IS 'Server-only: Recorder page voice notes and AI takeaways/action items for call recordings. Read/written only through recorder.functions.ts.';