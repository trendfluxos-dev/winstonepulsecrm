-- 1) Hard daily lead cap: 50 unique leads per agent per Asia/Dhaka day, every assignment path.
CREATE TABLE IF NOT EXISTS public.lead_daily_assignment_ledger (
  agent_id uuid NOT NULL,
  work_date date NOT NULL,
  lead_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, work_date, lead_id)
);
GRANT ALL ON public.lead_daily_assignment_ledger TO service_role;
ALTER TABLE public.lead_daily_assignment_ledger ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.lead_daily_assignment_ledger IS 'Server-only: unique leads assigned per agent per Dhaka day; enforces the 50/day cap.';

CREATE OR REPLACE FUNCTION public.enforce_daily_lead_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner uuid := NEW.assigned_to;
  d date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  n integer;
BEGIN
  IF owner IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT DISTINCT FROM owner THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(owner::text || ':' || d::text, 0));
  IF EXISTS (SELECT 1 FROM public.lead_daily_assignment_ledger
             WHERE agent_id = owner AND work_date = d AND lead_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO n FROM public.lead_daily_assignment_ledger WHERE agent_id = owner AND work_date = d;
  IF n >= 50 THEN
    RAISE EXCEPTION 'Daily lead cap reached: 50 leads per agent per Dhaka day' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.lead_daily_assignment_ledger (agent_id, work_date, lead_id)
  VALUES (owner, d, NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_daily_lead_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_leads_daily_cap ON public.leads;
CREATE TRIGGER zz_leads_daily_cap
  BEFORE INSERT OR UPDATE OF assigned_to, assigned_agent_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_lead_cap();

INSERT INTO public.lead_daily_assignment_ledger (agent_id, work_date, lead_id)
SELECT DISTINCT to_agent_id, (created_at AT TIME ZONE 'Asia/Dhaka')::date, lead_id
FROM public.lead_assignments
WHERE to_agent_id IS NOT NULL
  AND (created_at AT TIME ZONE 'Asia/Dhaka')::date = (now() AT TIME ZONE 'Asia/Dhaka')::date
ON CONFLICT DO NOTHING;

-- 2) Architecture charge $35.29/month, 15% VAT included (base 30.69 + VAT 4.60). Historical snapshots stay immutable.
CREATE OR REPLACE FUNCTION public.validate_plan_code()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.plan_code NOT IN ('crm','os','architecture') THEN RAISE EXCEPTION 'invalid plan_code %', NEW.plan_code; END IF;
  IF TG_OP = 'UPDATE' AND NEW.plan_code IS DISTINCT FROM OLD.plan_code THEN RAISE EXCEPTION 'plan_code is immutable'; END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.snapshot_invoice_amounts()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.base_cents IS NULL THEN
      NEW.vat_rate_bps := 1500;
      IF NEW.plan_code = 'architecture' THEN
        NEW.total_cents := 3529;
        NEW.base_cents := round(3529 / 1.15);
        NEW.vat_cents := NEW.total_cents - NEW.base_cents;
      ELSE
        NEW.base_cents := CASE WHEN NEW.plan_code = 'os' THEN 4629 ELSE 1579 END;
        NEW.vat_cents := round(NEW.base_cents * 1500 / 10000.0);
        NEW.total_cents := NEW.base_cents + NEW.vat_cents;
      END IF;
    END IF;
  ELSIF OLD.total_cents IS NOT NULL AND (NEW.base_cents IS DISTINCT FROM OLD.base_cents
     OR NEW.vat_rate_bps IS DISTINCT FROM OLD.vat_rate_bps OR NEW.vat_cents IS DISTINCT FROM OLD.vat_cents
     OR NEW.total_cents IS DISTINCT FROM OLD.total_cents OR NEW.currency IS DISTINCT FROM OLD.currency) THEN
    RAISE EXCEPTION 'Invoice amount snapshot is immutable';
  END IF;
  RETURN NEW;
END $function$;

ALTER TABLE public.system_maintenance ALTER COLUMN plan_code SET DEFAULT 'architecture';
ALTER TABLE public.system_maintenance ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz DEFAULT now();
ALTER TABLE public.system_maintenance ADD COLUMN IF NOT EXISTS invoice_approved_at timestamptz;
ALTER TABLE public.system_maintenance ADD COLUMN IF NOT EXISTS invoice_approved_by text;
COMMENT ON COLUMN public.system_maintenance.invoice_approved_at IS 'Customer accepted the invoice. Approval is NOT payment and never unlocks the CRM.';