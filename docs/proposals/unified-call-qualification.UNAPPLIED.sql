-- NOT APPLIED. Review and apply before publishing unified qualification code.
-- No data updates/backfill: historical reports and classification history remain intact.
CREATE OR REPLACE FUNCTION public.validate_call_report() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE q text; score integer := 0; expected text;
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'submitted' THEN
    IF NEW.category IS NULL OR NEW.category NOT IN ('hot_lead','follow_up','interested','not_interested','callback','no_answer','wrong_number','closed_converted') THEN
      RAISE EXCEPTION 'invalid or missing call report category';
    END IF;
    IF coalesce(btrim(NEW.summary),'') = '' THEN RAISE EXCEPTION 'call summary is required'; END IF;
    IF NEW.category IN ('not_interested','wrong_number') AND coalesce(btrim(NEW.reason),'') = '' THEN
      RAISE EXCEPTION 'this category requires a reason';
    END IF;
    -- Only new finalization is subject to the new contract; legacy note corrections remain possible.
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' THEN
      IF NEW.category IN ('not_interested','wrong_number') THEN
        NEW.evaluation_answers := NULL; NEW.evaluation_score := NULL; NEW.evaluation_model := NULL;
        NEW.temperature := NULL; NEW.grade := NULL; NEW.follow_up_priority := NULL;
      ELSIF NEW.connected THEN
        IF NEW.grade IS NULL OR NEW.grade NOT IN ('A','B','C','D') THEN RAISE EXCEPTION 'select Grade A/B/C/D'; END IF;
        FOREACH q IN ARRAY ARRAY['project_interest','asked_price','wanted_info','visit_interest','decision_30d','wants_follow_up'] LOOP
          IF jsonb_typeof(NEW.evaluation_answers->q) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'answer all six questions Yes/No'; END IF;
          IF (NEW.evaluation_answers->>q)::boolean THEN
            score := score + CASE q WHEN 'project_interest' THEN 15 WHEN 'asked_price' THEN 15 WHEN 'wanted_info' THEN 10 WHEN 'visit_interest' THEN 20 WHEN 'decision_30d' THEN 20 ELSE 10 END;
          END IF;
        END LOOP;
        expected := CASE WHEN score <= 20 THEN 'cold' WHEN score <= 50 THEN 'warm' ELSE 'hot' END;
        IF NEW.evaluation_score IS DISTINCT FROM score OR NEW.temperature IS DISTINCT FROM expected THEN RAISE EXCEPTION 'qualification score/temperature mismatch'; END IF;
      END IF;
    END IF;
    IF NEW.submitted_at IS NULL THEN NEW.submitted_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_lead_completion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.work_state = 'completed' AND (NEW.temperature IS NULL OR NEW.grade IS NULL)
    AND NOT (coalesce(NEW.outcome_category,'') IN ('not_interested','wrong_number') AND EXISTS (
      SELECT 1 FROM public.call_reports r WHERE r.lead_id = NEW.id
        AND r.agent_id = coalesce(NEW.assigned_to,NEW.assigned_agent_id)
        AND r.category = NEW.outcome_category AND length(btrim(coalesce(r.reason,''))) > 0
        AND r.status IN ('pending','queued','submitted')
    )) THEN RAISE EXCEPTION 'classification or confirmed disqualification required'; END IF;
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_leader')) THEN
    RAISE EXCEPTION 'Only supervisors may change lead assignment';
  END IF;
  RETURN NEW;
END $$;
-- Existing trigger bindings and grants/RLS are unchanged. No SECURITY DEFINER added.
-- Recovery: restore prior function bodies from migrations 0052/0025; never restore/delete data rows.