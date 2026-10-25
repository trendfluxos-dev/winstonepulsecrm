-- Append-only evidence log for the Meta verification checklist on /inbox.
-- Records staff-confirmed evidence per track; never stores access tokens
-- (the server function rejects token-like notes before insert).
CREATE TABLE public.meta_verification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track text NOT NULL CHECK (track IN ('app_review','live_mode','page_consent','messages_subscription')),
  outcome text NOT NULL CHECK (outcome IN ('verified','failed')),
  note text NOT NULL,
  actor uuid,
  actor_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.meta_verification_records TO service_role;
ALTER TABLE public.meta_verification_records ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.block_meta_verification_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Meta verification records are append-only';
END
$$;

CREATE TRIGGER meta_verification_records_append_only
  BEFORE UPDATE OR DELETE ON public.meta_verification_records
  FOR EACH ROW EXECUTE FUNCTION public.block_meta_verification_mutation();