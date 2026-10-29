CREATE TABLE public.device_call_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  phone_model text NOT NULL,
  android_version text NOT NULL,
  app_version text,
  perm_phone text NOT NULL,
  perm_call_log text NOT NULL,
  perm_microphone text NOT NULL,
  perm_notifications text NOT NULL,
  network text NOT NULL,
  call_type text NOT NULL,
  call_detected text NOT NULL,
  recording text NOT NULL,
  summary text NOT NULL,
  notes text
);
GRANT ALL ON public.device_call_tests TO service_role;
ALTER TABLE public.device_call_tests ENABLE ROW LEVEL SECURITY;
CREATE INDEX device_call_tests_profile_idx ON public.device_call_tests (profile_id, created_at DESC);