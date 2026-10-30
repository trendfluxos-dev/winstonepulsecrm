-- Minimal local schema for SQL regression tests. Throwaway database only;
-- never run against the project database. Function bodies of
-- create_report_follow_up_atomic / transition_follow_up_atomic are copies of
-- the live definitions read on 2026-10-30.
DO $$ BEGIN
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE public.leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, phone_number text, notes text,
  status text CHECK (status IN ('pending','contacted','follow_up','closed','interested','not_interested')), outcome_category text,
  last_call_at timestamptz, temperature text, grade text, classification_note text, classified_at timestamptz, classified_by uuid,
  work_state text, unanswered_attempts int DEFAULT 0, retry_after timestamptz, assigned_to uuid, assigned_agent_id uuid,
  call_attempts int DEFAULT 0, is_verified boolean DEFAULT false);
CREATE TABLE public.call_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid, agent_id uuid, recording_id uuid, device_id uuid,
  phone_number text, duration_seconds int, connected boolean, status text, category text, note text, reason text, follow_up_at timestamptz,
  ai_decision text, submitted_at timestamptz, summary text,
  temperature text CHECK (temperature IS NULL OR temperature IN ('hot','warm','cold')),
  grade text CHECK (grade IS NULL OR grade IN ('A','B','C','D')), connection_verified boolean, interest text, requirement text,
  customer_response text, next_action text, no_follow_up_reason text, smart_reasons jsonb, evaluation_answers jsonb, evaluation_score int,
  evaluation_model text, follow_up_priority text, next_best_action text, no_follow_up_note text, duration_source text, duration_synced_at timestamptz,
  created_at timestamptz DEFAULT now());
CREATE TABLE public.follow_up_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid, agent_id uuid, report_id uuid, recording_id uuid,
  customer_name text, phone_number text, category text, priority text, note text, reason_code text, customer_response text, next_action text,
  previous_call_id uuid, scheduled_at timestamptz, reminder_minutes int, parent_follow_up_id uuid, idempotency_key text UNIQUE, status text DEFAULT 'upcoming',
  completed_at timestamptz, outcome text, transition_reason text, transition_actor uuid, transition_key uuid, notified_at timestamptz);
CREATE TABLE public.follow_up_changes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), follow_up_id uuid, correlation_id uuid);
CREATE OR REPLACE FUNCTION public.log_follow_up_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.transition_key IS NOT NULL AND NEW.transition_key IS DISTINCT FROM OLD.transition_key THEN
    INSERT INTO public.follow_up_changes(follow_up_id, correlation_id) VALUES (NEW.id, NEW.transition_key); END IF; RETURN NEW; END $$;
CREATE TRIGGER fuc AFTER UPDATE ON public.follow_up_events FOR EACH ROW EXECUTE FUNCTION public.log_follow_up_change();
CREATE TABLE public.lead_classifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid, agent_id uuid, report_id uuid,
  temperature text NOT NULL, grade text NOT NULL, note text, source text, classified_at timestamptz);
CREATE TABLE public.lead_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid, agent_id uuid, recording_id uuid, kind text, detail text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE public.audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action text, entity_type text, entity_id text, actor_profile_id uuid, metadata jsonb);
-- Fault injection switch for the timeline stage.
CREATE TABLE public.test_faults (stage text PRIMARY KEY);
CREATE OR REPLACE FUNCTION public.test_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.test_faults WHERE stage = TG_ARGV[0]) THEN RAISE EXCEPTION 'injected fault: %', TG_ARGV[0]; END IF; RETURN NEW; END $$;
CREATE TRIGGER f_events BEFORE INSERT ON public.lead_events FOR EACH ROW EXECUTE FUNCTION public.test_fault('events');
CREATE TRIGGER f_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.test_fault('audit');
CREATE TRIGGER f_class BEFORE INSERT ON public.lead_classifications FOR EACH ROW EXECUTE FUNCTION public.test_fault('classification');

CREATE OR REPLACE FUNCTION public.create_report_follow_up_atomic(_agent uuid, _report uuid, _patch jsonb, _reason text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE f public.follow_up_events%ROWTYPE; prev public.follow_up_events%ROWTYPE; result uuid; l public.leads%ROWTYPE; r public.call_reports%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.call_reports WHERE id=_report FOR UPDATE;
 IF NOT FOUND OR r.agent_id IS DISTINCT FROM _agent THEN RAISE EXCEPTION 'Report does not belong to agent'; END IF;
 SELECT * INTO l FROM public.leads WHERE id=r.lead_id FOR UPDATE;
 IF coalesce(l.assigned_to,l.assigned_agent_id) IS DISTINCT FROM _agent THEN RAISE EXCEPTION 'Lead owner changed'; END IF;
 SELECT id INTO result FROM public.follow_up_events WHERE idempotency_key='report:'||_report::text;
 IF result IS NOT NULL THEN RETURN result; END IF;
 f:=jsonb_populate_record(NULL::public.follow_up_events,_patch);
 IF f.lead_id IS DISTINCT FROM r.lead_id OR f.agent_id IS DISTINCT FROM _agent OR f.scheduled_at IS NULL OR f.scheduled_at<=now() THEN RAISE EXCEPTION 'Valid owned future follow-up required'; END IF;
 FOR prev IN SELECT * FROM public.follow_up_events WHERE lead_id=l.id AND agent_id=_agent AND status IN ('upcoming','due','missed') ORDER BY scheduled_at,id FOR UPDATE LOOP
  IF length(trim(coalesce(_reason,'')))=0 THEN RAISE EXCEPTION 'Reschedule reason required'; END IF;
  UPDATE public.follow_up_events SET status='rescheduled',transition_reason=trim(_reason),transition_actor=_agent,transition_key=gen_random_uuid() WHERE id=prev.id;
 END LOOP;
 INSERT INTO public.follow_up_events(lead_id,agent_id,report_id,recording_id,customer_name,phone_number,category,priority,note,reason_code,customer_response,next_action,previous_call_id,scheduled_at,reminder_minutes,parent_follow_up_id,idempotency_key)
 VALUES(l.id,_agent,_report,r.recording_id,l.name,l.phone_number,f.category,coalesce(f.priority,'normal'),f.note,f.reason_code,f.customer_response,f.next_action,r.recording_id,f.scheduled_at,coalesce(f.reminder_minutes,30),prev.id,'report:'||_report::text) RETURNING id INTO result;
 RETURN result;
END $function$;
CREATE OR REPLACE FUNCTION public.transition_follow_up_atomic(_event uuid, _actor uuid DEFAULT NULL::uuid, _action text DEFAULT NULL::text, _reason text DEFAULT NULL::text, _scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _key uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE f public.follow_up_events%ROWTYPE; child uuid;
BEGIN
 IF _action IS NULL OR _action NOT IN ('complete','reschedule','cancel','miss') OR length(trim(coalesce(_reason,'')))=0 OR _key IS NULL THEN RAISE EXCEPTION 'Valid action, reason and idempotency key required'; END IF;
 SELECT * INTO f FROM public.follow_up_events WHERE id=_event FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Follow-up not found'; END IF;
 PERFORM 1 FROM public.leads WHERE id=f.lead_id FOR UPDATE;
 IF _actor IS NOT NULL AND (f.agent_id IS DISTINCT FROM _actor OR NOT EXISTS(SELECT 1 FROM public.leads WHERE id=f.lead_id AND coalesce(assigned_to,assigned_agent_id)=_actor)) THEN RAISE EXCEPTION 'Follow-up is not assigned to actor'; END IF;
 IF EXISTS(SELECT 1 FROM public.follow_up_changes WHERE follow_up_id=f.id AND correlation_id=_key) THEN
  SELECT id INTO child FROM public.follow_up_events WHERE parent_follow_up_id=f.id;
  RETURN jsonb_build_object('ok',true,'alreadyApplied',true,'followUpId',coalesce(child,f.id));
 END IF;
 IF f.status NOT IN ('upcoming','due','missed') THEN RAISE EXCEPTION 'Follow-up already resolved'; END IF;
 IF _action='miss' AND (f.scheduled_at>now() OR f.status='missed') THEN RAISE EXCEPTION 'Follow-up is not newly missed'; END IF;
 IF _action='reschedule' THEN
  IF _scheduled_at IS NULL OR _scheduled_at<=now() THEN RAISE EXCEPTION 'Choose a future follow-up time'; END IF;
  UPDATE public.follow_up_events SET status='rescheduled',transition_reason=trim(_reason),transition_actor=_actor,transition_key=_key WHERE id=f.id;
  INSERT INTO public.follow_up_events(lead_id,agent_id,report_id,recording_id,customer_name,phone_number,category,priority,note,reason_code,customer_response,next_action,previous_call_id,scheduled_at,reminder_minutes,parent_follow_up_id,idempotency_key)
  VALUES(f.lead_id,f.agent_id,f.report_id,f.recording_id,f.customer_name,f.phone_number,f.category,f.priority,f.note,f.reason_code,f.customer_response,f.next_action,f.previous_call_id,_scheduled_at,f.reminder_minutes,f.id,'reschedule:'||_key::text) RETURNING id INTO child;
 ELSE
  UPDATE public.follow_up_events SET status=CASE _action WHEN 'complete' THEN 'done' WHEN 'cancel' THEN 'cancelled' ELSE 'missed' END,completed_at=CASE WHEN _action='complete' THEN now() ELSE NULL END,outcome=CASE WHEN _action='complete' THEN trim(_reason) ELSE outcome END,transition_reason=trim(_reason),transition_actor=_actor,transition_key=_key WHERE id=f.id;
 END IF;
 INSERT INTO public.audit_logs(action,entity_type,entity_id,actor_profile_id,metadata) VALUES('follow_up_'||_action,'follow_up_event',f.id::text,_actor,jsonb_build_object('reason',trim(_reason),'replacementId',child,'correlationId',_key));
 RETURN jsonb_build_object('ok',true,'alreadyApplied',false,'followUpId',coalesce(child,f.id));
END $function$;
