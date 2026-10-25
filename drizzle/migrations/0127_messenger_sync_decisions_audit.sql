-- Append-only audit log for every Messenger sync enable/disable decision.
-- Records staff, time, verification snapshot and reason so sync can never
-- be enabled silently before approval verification.
CREATE TABLE public.messenger_sync_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('enable','disable')),
  actor uuid,
  actor_label text,
  verified_tracks text[] NOT NULL DEFAULT '{}',
  missing_tracks text[] NOT NULL DEFAULT '{}',
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.messenger_sync_decisions TO service_role;
ALTER TABLE public.messenger_sync_decisions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.block_messenger_sync_decision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Messenger sync decisions are append-only';
END
$$;

CREATE TRIGGER messenger_sync_decisions_append_only
  BEFORE UPDATE OR DELETE ON public.messenger_sync_decisions
  FOR EACH ROW EXECUTE FUNCTION public.block_messenger_sync_decision_mutation();