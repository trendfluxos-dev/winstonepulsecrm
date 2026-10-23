CREATE TABLE public.unit_inventory_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text NOT NULL,
  filename text NOT NULL,
  format_version integer NOT NULL,
  record_count integer NOT NULL,
  checksum text NOT NULL,
  payload jsonb NOT NULL,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.unit_inventory_backups TO service_role;
ALTER TABLE public.unit_inventory_backups ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.unit_inventory_backups IS 'Server-only, append-only unit inventory backups (pre-restore snapshots).';
CREATE OR REPLACE FUNCTION public.block_unit_backup_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Unit inventory backups are append-only'; END $$;
CREATE TRIGGER unit_inventory_backups_immutable BEFORE UPDATE OR DELETE ON public.unit_inventory_backups FOR EACH ROW EXECUTE FUNCTION public.block_unit_backup_mutation();