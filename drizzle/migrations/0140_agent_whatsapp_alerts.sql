-- Agent WhatsApp alerts (count-only, template-only) + signed webhook inbox. Server-only tables.
CREATE TABLE public.agent_whatsapp_optins (
  agent_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  whatsapp_number text NOT NULL,
  opted_in boolean NOT NULL DEFAULT false,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  opt_out_source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.agent_whatsapp_optins TO service_role;
ALTER TABLE public.agent_whatsapp_optins ENABLE ROW LEVEL SECURITY;
CREATE INDEX agent_whatsapp_optins_number_idx ON public.agent_whatsapp_optins (whatsapp_number);

CREATE TABLE public.agent_whatsapp_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('new_leads','daily_progress','test')),
  work_date date NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  template text NOT NULL,
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
GRANT ALL ON public.agent_whatsapp_alerts TO service_role;
ALTER TABLE public.agent_whatsapp_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX agent_whatsapp_alerts_agent_day_idx ON public.agent_whatsapp_alerts (agent_id, work_date, kind);

CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX whatsapp_webhook_events_pending_idx ON public.whatsapp_webhook_events (next_attempt_at) WHERE processed_at IS NULL;

INSERT INTO public.system_settings (key, value) VALUES ('agent_whatsapp_alerts_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;