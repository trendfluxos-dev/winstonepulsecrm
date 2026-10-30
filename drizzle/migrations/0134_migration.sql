CREATE TABLE public.phone_test_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  app_version text,
  phone_model text NOT NULL,
  results jsonb NOT NULL,
  failed_count integer NOT NULL DEFAULT 0,
  issue text,
  sent_to_it boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.phone_test_reports TO service_role;
ALTER TABLE public.phone_test_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX phone_test_reports_profile_idx ON public.phone_test_reports(profile_id, created_at DESC);
CREATE INDEX phone_test_reports_it_idx ON public.phone_test_reports(created_at DESC) WHERE sent_to_it;