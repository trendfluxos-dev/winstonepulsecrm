-- Credential-incident tracker: records exposure/revocation/replacement status
-- of credentials WITHOUT ever storing secret values. Server-only (admin client),
-- append-only, IT-gated through server functions.
CREATE TABLE public.credential_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL,
  status text NOT NULL,
  note text NOT NULL,
  actor uuid,
  actor_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.credential_incidents TO service_role;

ALTER TABLE public.credential_incidents ENABLE ROW LEVEL SECURITY;
-- No policies: only the server-side admin client (service_role, bypasses RLS)
-- can read or insert. Browser roles get nothing.

-- Append-only: updates and deletes are blocked for every role.
CREATE OR REPLACE FUNCTION public.credential_incidents_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'credential_incidents is append-only';
END;
$$;

CREATE TRIGGER credential_incidents_no_update
  BEFORE UPDATE OR DELETE ON public.credential_incidents
  FOR EACH ROW EXECUTE FUNCTION public.credential_incidents_append_only();