-- AI Lead Pipeline foundation: consent events, n8n receipts, BANT scores.
-- All three are server-only (service_role) and append-only.

CREATE OR REPLACE FUNCTION public.append_only_block()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'This table is append-only; add a correcting row instead';
END;
$$;

CREATE TABLE public.lead_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  lead_id uuid,
  purpose text NOT NULL,
  action text NOT NULL,
  source text,
  consent_text text,
  actor uuid,
  actor_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_consent_events TO service_role;
ALTER TABLE public.lead_consent_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER lead_consent_events_append_only
  BEFORE UPDATE OR DELETE ON public.lead_consent_events
  FOR EACH ROW EXECUTE FUNCTION public.append_only_block();

CREATE TABLE public.n8n_event_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  payload_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'stored',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.n8n_event_receipts TO service_role;
ALTER TABLE public.n8n_event_receipts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER n8n_event_receipts_append_only
  BEFORE UPDATE OR DELETE ON public.n8n_event_receipts
  FOR EACH ROW EXECUTE FUNCTION public.append_only_block();

CREATE TABLE public.lead_bant_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  model text NOT NULL,
  budget smallint,
  authority smallint,
  need smallint,
  timeline smallint,
  total smallint NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_bant_scores TO service_role;
ALTER TABLE public.lead_bant_scores ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER lead_bant_scores_append_only
  BEFORE UPDATE OR DELETE ON public.lead_bant_scores
  FOR EACH ROW EXECUTE FUNCTION public.append_only_block();