-- Function-only change. No data updates/backfill; historical reports, leads and classification history stay intact.
-- Connected property-sales reports: Grade A/B/C/D + six Yes/No answers required; score/temperature must match the fixed 15/15/10/20/20/10 weights and 20/50 cutoffs.
-- Fast Disqualification (not_interested / wrong_number incl. fake): no grade/score/temperature required or stored.
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
    -- Only new finalization follows the new contract; legacy note corrections remain possible.
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' THEN
      IF NEW.category IN ('not_interested','wrong_number') THEN
        NEW.evaluation_answers := NULL; NEW.evaluation_score := NULL; NEW.evaluation_model := NULL;
        NEW.temperature := NULL; NEW.grade := NULL; NEW.follow_up_priority := NULL;
      ELSIF NEW.connected THEN
        IF NEW.grade IS NULL OR NEW.grade NOT IN ('A','B','C','D') THEN
          RAISE EXCEPTION 'কল রিপোর্টে একটি Grade A / B / C / D বাছাই করুন (select Grade A/B/C/D)';
        END IF;
        FOREACH q IN ARRAY ARRAY['project_interest','asked_price','wanted_info','visit_interest','decision_30d','wants_follow_up'] LOOP
          IF jsonb_typeof(NEW.evaluation_answers->q) IS DISTINCT FROM 'boolean' THEN
            RAISE EXCEPTION 'ছয়টি প্রশ্নের প্রতিটিতে হ্যাঁ / না দিন (answer all six questions Yes/No)';
          END IF;
          IF (NEW.evaluation_answers->>q)::boolean THEN
            score := score + CASE q WHEN 'project_interest' THEN 15 WHEN 'asked_price' THEN 15 WHEN 'wanted_info' THEN 10 WHEN 'visit_interest' THEN 20 WHEN 'decision_30d' THEN 20 ELSE 10 END;
          END IF;
        END LOOP;
        expected := CASE WHEN score <= 20 THEN 'cold' WHEN score <= 50 THEN 'warm' ELSE 'hot' END;
        IF NEW.evaluation_score IS DISTINCT FROM score OR NEW.temperature IS DISTINCT FROM expected THEN
          RAISE EXCEPTION 'qualification score/temperature mismatch';
        END IF;
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
    -- Only the server-side atomic finalizer may complete a confirmed Fast Disqualification
    -- without classification; direct signed-in writers gain no bypass.
    AND NOT (auth.uid() IS NULL AND NEW.status = 'closed'
      AND coalesce(NEW.outcome_category,'') IN ('not_interested','wrong_number')) THEN
    RAISE EXCEPTION 'শ্রেণিবিন্যাস (Hot/Warm/Cold ও গ্রেড) ছাড়া লিড সম্পন্ন করা যাবে না';
  END IF;

  IF TG_OP = 'UPDATE'
     AND auth.uid() IS NOT NULL
     AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_leader')) THEN
    RAISE EXCEPTION 'শুধুমাত্র কোঅর্ডিনেটর লিড বদল করতে পারবেন';
  END IF;

  RETURN NEW;
END $$;
-- Trigger bindings, grants and RLS unchanged; no SECURITY DEFINER added.
-- Recovery: restore the prior function bodies; never delete or restore business rows.
