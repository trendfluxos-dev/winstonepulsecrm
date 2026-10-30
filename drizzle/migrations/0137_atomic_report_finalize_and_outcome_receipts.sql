-- P1-1: one transaction for report submit + lead + classification + follow-up + timeline + audit.
-- Exactly-once: the report row is locked FOR UPDATE and a submitted report returns alreadySubmitted.
-- Reassigned leads: report accepted as history, lead/classification/follow-ups untouched.
CREATE OR REPLACE FUNCTION public.finalize_call_report_v2(
  _report uuid, _agent uuid, _report_patch jsonb, _lead_patch jsonb,
  _followup jsonb, _followup_reason text, _complete_reason text,
  _classify boolean, _evaluation_detail text, _outcome text, _audit jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE r public.call_reports%ROWTYPE; p public.call_reports%ROWTYPE; v public.leads%ROWTYPE; l public.leads%ROWTYPE;
  reassigned boolean; follow_id uuid; e record;
BEGIN
  SELECT * INTO r FROM public.call_reports WHERE id=_report FOR UPDATE;
  IF NOT FOUND OR r.agent_id IS DISTINCT FROM _agent THEN RAISE EXCEPTION 'Report does not belong to agent'; END IF;
  IF r.status='submitted' THEN RETURN jsonb_build_object('alreadySubmitted',true); END IF;
  SELECT * INTO v FROM public.leads WHERE id=r.lead_id FOR UPDATE;
  reassigned := NOT FOUND OR coalesce(v.assigned_to, v.assigned_agent_id) IS DISTINCT FROM _agent;
  p := jsonb_populate_record(r, coalesce(_report_patch,'{}'::jsonb));
  IF NOT reassigned THEN
    IF _followup IS NOT NULL THEN
      follow_id := public.create_report_follow_up_atomic(_agent, _report, _followup, _followup_reason);
    ELSIF _complete_reason IS NOT NULL AND length(trim(_complete_reason))>0 THEN
      FOR e IN SELECT id FROM public.follow_up_events WHERE lead_id=r.lead_id AND agent_id=_agent AND status IN ('upcoming','due','missed') ORDER BY scheduled_at,id LOOP
        PERFORM public.transition_follow_up_atomic(e.id, _agent, 'complete', _complete_reason, NULL,
          md5('report-complete:'||_report::text||':'||e.id::text)::uuid);
      END LOOP;
    END IF;
    IF _lead_patch IS NOT NULL THEN
      l := jsonb_populate_record(v, _lead_patch);
      UPDATE public.leads SET status=l.status, outcome_category=l.outcome_category, notes=l.notes, last_call_at=l.last_call_at,
        temperature=l.temperature, grade=l.grade, classification_note=l.classification_note, classified_at=l.classified_at,
        classified_by=l.classified_by, work_state=l.work_state, unanswered_attempts=l.unanswered_attempts, retry_after=l.retry_after
      WHERE id=r.lead_id;
    END IF;
    IF _classify AND p.temperature IS NOT NULL AND p.grade IS NOT NULL THEN
      INSERT INTO public.lead_classifications(lead_id,agent_id,report_id,temperature,grade,note,source,classified_at)
      VALUES(r.lead_id,_agent,r.id,p.temperature,p.grade,l.classification_note,'manual',now());
    END IF;
  END IF;
  IF _evaluation_detail IS NOT NULL THEN
    INSERT INTO public.lead_events(lead_id,agent_id,recording_id,kind,detail) VALUES(r.lead_id,_agent,r.recording_id,'evaluation_recorded',_evaluation_detail);
  END IF;
  IF _outcome IS NOT NULL THEN
    INSERT INTO public.lead_events(lead_id,agent_id,recording_id,kind,detail) VALUES(r.lead_id,_agent,r.recording_id,'outcome_logged',_outcome);
  END IF;
  UPDATE public.call_reports SET status='submitted', category=p.category, summary=p.summary, note=p.note, reason=p.reason,
    follow_up_at=p.follow_up_at, connected=p.connected, duration_seconds=p.duration_seconds, duration_source=p.duration_source,
    duration_synced_at=p.duration_synced_at, connection_verified=p.connection_verified, temperature=p.temperature, grade=p.grade,
    ai_decision=p.ai_decision, interest=p.interest, requirement=p.requirement, customer_response=p.customer_response,
    next_action=p.next_action, no_follow_up_reason=p.no_follow_up_reason, no_follow_up_note=p.no_follow_up_note,
    smart_reasons=p.smart_reasons, evaluation_answers=p.evaluation_answers, evaluation_score=p.evaluation_score,
    evaluation_model=p.evaluation_model, follow_up_priority=p.follow_up_priority, next_best_action=p.next_best_action,
    submitted_at=now()
  WHERE id=r.id;
  INSERT INTO public.audit_logs(action,entity_type,entity_id,actor_profile_id,metadata)
  VALUES('call_report_submitted','call_report',r.id::text,_agent,
    coalesce(_audit,'{}'::jsonb) || jsonb_build_object('leadId',r.lead_id,'followUpId',follow_id,'reassigned',reassigned,'atomic',true));
  RETURN jsonb_build_object('alreadySubmitted',false,'reassigned',reassigned,'followUpId',follow_id,
    'currentOwnerId', CASE WHEN reassigned THEN coalesce(v.assigned_to, v.assigned_agent_id) END);
END $fn$;
REVOKE ALL ON FUNCTION public.finalize_call_report_v2(uuid,uuid,jsonb,jsonb,jsonb,text,text,boolean,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_call_report_v2(uuid,uuid,jsonb,jsonb,jsonb,text,text,boolean,text,text,jsonb) TO service_role;

-- P2-3: phone outcome idempotency scoped to agent + call_uid (server-only receipts).
CREATE TABLE IF NOT EXISTS public.phone_outcome_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  call_uid text NOT NULL CHECK (length(call_uid) BETWEEN 8 AND 80),
  lead_id uuid NOT NULL,
  outcome text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, call_uid)
);
GRANT ALL ON public.phone_outcome_receipts TO service_role;
ALTER TABLE public.phone_outcome_receipts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_phone_outcome_atomic(
  _agent uuid, _lead uuid, _call_uid text, _outcome text, _status text, _notes text, _connected boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE prior public.phone_outcome_receipts%ROWTYPE; v public.leads%ROWTYPE; stamp timestamptz := now(); res jsonb;
BEGIN
  IF _call_uid IS NULL OR length(_call_uid) NOT BETWEEN 8 AND 80 THEN RAISE EXCEPTION 'Valid call_uid required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('phone_outcome:'||_agent::text||':'||_call_uid));
  SELECT * INTO prior FROM public.phone_outcome_receipts WHERE agent_id=_agent AND call_uid=_call_uid;
  IF FOUND THEN
    IF prior.lead_id IS DISTINCT FROM _lead THEN RAISE EXCEPTION 'call_uid already used for another lead'; END IF;
    RETURN prior.result || jsonb_build_object('duplicate',true);
  END IF;
  SELECT * INTO v FROM public.leads WHERE id=_lead FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown lead'; END IF;
  IF v.assigned_to IS NULL AND v.assigned_agent_id IS NULL
     OR (v.assigned_to IS NOT NULL AND v.assigned_to <> _agent)
     OR (v.assigned_agent_id IS NOT NULL AND v.assigned_agent_id <> _agent) THEN
    RAISE EXCEPTION 'Lead not assigned to agent';
  END IF;
  UPDATE public.leads SET status=_status, outcome_category=_outcome,
    notes = CASE WHEN nullif(trim(coalesce(_notes,'')),'') IS NULL THEN notes
      ELSE coalesce(notes||E'\n\n','')||'['||to_char(stamp AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI')||'] '||trim(_notes) END,
    call_attempts = coalesce(call_attempts,0)+1, last_call_at=stamp,
    is_verified = CASE WHEN _connected THEN true ELSE is_verified END
  WHERE id=_lead;
  INSERT INTO public.lead_events(lead_id,agent_id,kind,detail) VALUES(_lead,_agent,'outcome_logged','কলের ফল: '||replace(_outcome,'_',' '));
  res := jsonb_build_object('ok',true,'lead_id',_lead,'status',_status,'outcome',_outcome,'server_time',stamp);
  INSERT INTO public.phone_outcome_receipts(agent_id,call_uid,lead_id,outcome,result) VALUES(_agent,_call_uid,_lead,_outcome,res);
  RETURN res || jsonb_build_object('duplicate',false);
END $fn$;
REVOKE ALL ON FUNCTION public.apply_phone_outcome_atomic(uuid,uuid,text,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_phone_outcome_atomic(uuid,uuid,text,text,text,text,boolean) TO service_role;