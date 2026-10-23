CREATE TABLE public.project_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.project_catalog(id),
  project_name text NOT NULL,
  code text NOT NULL,
  kind text NOT NULL,
  floor text,
  size_sqft numeric,
  size_katha numeric,
  bedrooms numeric,
  bathrooms numeric,
  price_bdt numeric,
  status text NOT NULL DEFAULT 'available',
  updated_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_units_kind_chk CHECK (kind IN ('apartment','commercial','plot')),
  CONSTRAINT project_units_status_chk CHECK (status IN ('available','booked','sold','blocked'))
);
CREATE UNIQUE INDEX project_units_code_uq ON public.project_units (project_id, lower(code));
GRANT ALL ON public.project_units TO service_role;
ALTER TABLE public.project_units ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.project_units IS 'Unit inventory; server-only access. Units are never deleted — mark blocked.';
CREATE OR REPLACE FUNCTION public.block_project_unit_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Units are never deleted; mark them blocked'; END $$;
CREATE TRIGGER project_units_no_delete BEFORE DELETE ON public.project_units FOR EACH ROW EXECUTE FUNCTION public.block_project_unit_delete();
INSERT INTO public.project_units (id, project_id, project_name, code, kind, floor, size_sqft, size_katha, bedrooms, bathrooms, price_bdt, status, updated_by, updated_at)
SELECT (u->>'id')::uuid, (u->>'projectId')::uuid, u->>'projectName', u->>'code', u->>'kind', u->>'floor',
  (u->>'sizeSqft')::numeric, (u->>'sizeKatha')::numeric, (u->>'bedrooms')::numeric, (u->>'bathrooms')::numeric, (u->>'priceBdt')::numeric,
  u->>'status', coalesce(u->>'updatedBy',''), coalesce((u->>'updatedAt')::timestamptz, now())
FROM public.app_config c, jsonb_array_elements(coalesce(c.data::jsonb->'units','[]'::jsonb)) u
WHERE c.id = 'unit_inventory'
  AND EXISTS (SELECT 1 FROM public.project_catalog p WHERE p.id = (u->>'projectId')::uuid)
ON CONFLICT DO NOTHING;