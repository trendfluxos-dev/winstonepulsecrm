CREATE OR REPLACE FUNCTION public.enforce_daily_lead_cap()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  owner uuid := COALESCE(NEW.assigned_to, NEW.assigned_agent_id);
  old_owner uuid;
  d date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  n integer;
BEGIN
  IF owner IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    old_owner := COALESCE(OLD.assigned_to, OLD.assigned_agent_id);
    IF old_owner IS NOT DISTINCT FROM owner THEN RETURN NEW; END IF;
  END IF;
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
END $function$;