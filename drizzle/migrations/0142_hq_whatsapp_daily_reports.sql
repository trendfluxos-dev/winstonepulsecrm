CREATE TABLE public.hq_whatsapp_report_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  work_date date NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  template text NOT NULL,
  with_pdf boolean NOT NULL DEFAULT false,
  pdf_path text,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','accepted','sent','delivered','read','failed')),
  provider_message_id text UNIQUE,
  error_detail text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hq_whatsapp_report_sends TO service_role;
ALTER TABLE public.hq_whatsapp_report_sends ENABLE ROW LEVEL SECURITY;
CREATE INDEX hq_whatsapp_report_sends_day_idx ON public.hq_whatsapp_report_sends (work_date);

INSERT INTO public.system_settings (key, value) VALUES
  ('hq_daily_report_recipients', '["8801730320178","8801819225751","8801766667640"]'::jsonb),
  ('hq_daily_report_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;