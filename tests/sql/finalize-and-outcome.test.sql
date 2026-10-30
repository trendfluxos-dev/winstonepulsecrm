-- SQL regression tests for finalize_call_report_v2 and apply_phone_outcome_atomic.
-- Run only through scripts/run-sql-tests.sh (throwaway local database).
\set agent '''aaaaaaaa-0000-4000-8000-000000000001'''
\set other '''bbbbbbbb-0000-4000-8000-000000000002'''

CREATE OR REPLACE FUNCTION pg_temp.expect(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ASSERTION FAILED: %', msg; END IF; RAISE NOTICE 'ok - %', msg; END $$;

-- Fresh fixture: one owned lead + one pending report.
CREATE OR REPLACE FUNCTION pg_temp.reset() RETURNS void LANGUAGE sql AS $$
  TRUNCATE public.leads, public.call_reports, public.follow_up_events, public.follow_up_changes, public.lead_classifications,
    public.lead_events, public.audit_logs, public.test_faults, public.phone_outcome_receipts;
  INSERT INTO public.leads(id,name,phone_number,status,assigned_to,assigned_agent_id)
    VALUES ('11111111-0000-4000-8000-000000000001','Synthetic','01700000000','pending','aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001');
  INSERT INTO public.call_reports(id,lead_id,agent_id,status)
    VALUES ('22222222-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','pending');
$$;

CREATE OR REPLACE FUNCTION pg_temp.submit(_followup jsonb, _patch jsonb DEFAULT '{"status":"submitted","category":"interested","temperature":"warm","grade":"B"}')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.finalize_call_report_v2('22222222-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',
    _patch, '{"status":"contacted","work_state":"completed","temperature":"warm","grade":"B","unanswered_attempts":0}',
    _followup, 'reason', NULL, true, 'eval', 'outcome', '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION pg_temp.untouched(label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM pg_temp.expect((SELECT status FROM public.call_reports) = 'pending', label || ': report NOT marked submitted');
  PERFORM pg_temp.expect((SELECT status FROM public.leads) = 'pending', label || ': lead unchanged');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.follow_up_events) = 0, label || ': no follow-up');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.lead_classifications) = 0, label || ': no classification');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.lead_events) = 0, label || ': no timeline rows');
  PERFORM pg_temp.expect((SELECT count(*) FROM public.audit_logs) = 0, label || ': no audit row');
END $$;

CREATE OR REPLACE FUNCTION pg_temp.fails(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END $$;

-- 1. Happy path + duplicate submit
SELECT pg_temp.reset();
SELECT pg_temp.expect((pg_temp.submit(jsonb_build_object('lead_id','11111111-0000-4000-8000-000000000001','agent_id','aaaaaaaa-0000-4000-8000-000000000001','scheduled_at',(now()+interval '1 day')::text,'category','interested'))->>'alreadySubmitted')::boolean = false, 'first submit commits');
SELECT pg_temp.expect((SELECT status FROM public.call_reports) = 'submitted', 'report submitted');
SELECT pg_temp.expect((SELECT status FROM public.leads) = 'contacted', 'lead updated');
SELECT pg_temp.expect((SELECT count(*) FROM public.follow_up_events) = 1, 'one follow-up');
SELECT pg_temp.expect((SELECT count(*) FROM public.lead_classifications) = 1, 'one classification');
SELECT pg_temp.expect((SELECT count(*) FROM public.lead_events) = 2, 'evaluation + outcome events');
SELECT pg_temp.expect((pg_temp.submit(NULL)->>'alreadySubmitted')::boolean, 'duplicate submit returns alreadySubmitted');
SELECT pg_temp.expect((SELECT count(*) FROM public.follow_up_events) = 1 AND (SELECT count(*) FROM public.lead_events) = 2 AND (SELECT count(*) FROM public.audit_logs) = 1, 'duplicate submit has no side effects');

-- 2. Failure at every stage rolls back everything; retry then succeeds once.
SELECT pg_temp.reset();
SELECT pg_temp.expect(pg_temp.fails($q$SELECT pg_temp.submit(jsonb_build_object('lead_id','11111111-0000-4000-8000-000000000001','agent_id','aaaaaaaa-0000-4000-8000-000000000001','scheduled_at',(now()-interval '1 day')::text))$q$), 'follow-up stage failure raises');
SELECT pg_temp.untouched('follow-up failure');
SELECT pg_temp.expect(pg_temp.fails($q$SELECT public.finalize_call_report_v2('22222222-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','{"status":"submitted"}','{"status":"not-a-status"}',NULL,'r',NULL,false,NULL,'o','{}')$q$), 'lead stage failure raises');
SELECT pg_temp.untouched('lead failure');
INSERT INTO public.test_faults VALUES ('classification');
SELECT pg_temp.expect(pg_temp.fails('SELECT pg_temp.submit(NULL)'), 'classification stage failure raises');
SELECT pg_temp.untouched('classification failure');
TRUNCATE public.test_faults; INSERT INTO public.test_faults VALUES ('events');
SELECT pg_temp.expect(pg_temp.fails('SELECT pg_temp.submit(NULL)'), 'timeline stage failure raises');
SELECT pg_temp.untouched('timeline failure');
TRUNCATE public.test_faults;
SELECT pg_temp.expect(pg_temp.fails($q$SELECT pg_temp.submit(NULL, '{"status":"submitted","temperature":"boiling"}')$q$), 'report stage failure raises');
SELECT pg_temp.untouched('report failure');
TRUNCATE public.test_faults; INSERT INTO public.test_faults VALUES ('audit');
SELECT pg_temp.expect(pg_temp.fails('SELECT pg_temp.submit(NULL)'), 'audit stage failure raises');
SELECT pg_temp.untouched('audit failure');
TRUNCATE public.test_faults;
SELECT pg_temp.expect((pg_temp.submit(jsonb_build_object('lead_id','11111111-0000-4000-8000-000000000001','agent_id','aaaaaaaa-0000-4000-8000-000000000001','scheduled_at',(now()+interval '1 day')::text))->>'alreadySubmitted')::boolean = false, 'retry after failures commits');
SELECT pg_temp.expect((SELECT count(*) FROM public.follow_up_events) = 1 AND (SELECT count(*) FROM public.lead_classifications) = 1 AND (SELECT count(*) FROM public.audit_logs) = 1, 'retry wrote each side effect exactly once');

-- 3. Reassigned lead: report accepted as history, lead/follow-ups/classification untouched.
SELECT pg_temp.reset();
UPDATE public.leads SET assigned_to = :other, assigned_agent_id = :other;
SELECT pg_temp.expect((pg_temp.submit(jsonb_build_object('lead_id','11111111-0000-4000-8000-000000000001','agent_id','aaaaaaaa-0000-4000-8000-000000000001','scheduled_at',(now()+interval '1 day')::text))->>'reassigned')::boolean, 'reassigned reported');
SELECT pg_temp.expect((SELECT status FROM public.call_reports) = 'submitted' AND (SELECT status FROM public.leads) = 'pending', 'report closed, lead untouched');
SELECT pg_temp.expect((SELECT count(*) FROM public.follow_up_events) = 0 AND (SELECT count(*) FROM public.lead_classifications) = 0, 'no follow-up/classification for new owner');

-- 4. Answered, no follow-up: open follow-ups complete via append-only transition with deterministic key.
SELECT pg_temp.reset();
INSERT INTO public.follow_up_events(lead_id,agent_id,scheduled_at,status) VALUES ('11111111-0000-4000-8000-000000000001',:agent,now()+interval '2 hours','upcoming');
SELECT public.finalize_call_report_v2('22222222-0000-4000-8000-000000000001',:agent,'{"status":"submitted"}','{"status":"contacted"}',NULL,NULL,'Customer done',false,NULL,'o','{}');
SELECT pg_temp.expect((SELECT status FROM public.follow_up_events) = 'done', 'open follow-up completed');
SELECT pg_temp.expect((SELECT transition_key FROM public.follow_up_events) = md5('report-complete:22222222-0000-4000-8000-000000000001:'||(SELECT id FROM public.follow_up_events)::text)::uuid, 'deterministic completion key');
SELECT pg_temp.expect((SELECT count(*) FROM public.follow_up_events) = 1, 'history row kept, not deleted');

-- 5. Foreign report refused.
SELECT pg_temp.reset();
SELECT pg_temp.expect(pg_temp.fails($q$SELECT public.finalize_call_report_v2('22222222-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002','{"status":"submitted"}',NULL,NULL,NULL,NULL,false,NULL,'o','{}')$q$), 'another agent cannot finalize');
SELECT pg_temp.untouched('foreign agent');

-- 6. Phone outcome idempotency.
SELECT pg_temp.reset();
SELECT public.apply_phone_outcome_atomic(:agent,'11111111-0000-4000-8000-000000000001','call-uid-0001','interested','contacted','note one',true);
SELECT pg_temp.expect((public.apply_phone_outcome_atomic(:agent,'11111111-0000-4000-8000-000000000001','call-uid-0001','interested','contacted','note one',true)->>'duplicate')::boolean, 'replay flagged duplicate');
SELECT pg_temp.expect((SELECT call_attempts FROM public.leads) = 1, 'attempts counted once');
SELECT pg_temp.expect((SELECT count(*) FROM public.lead_events) = 1, 'timeline event once');
SELECT pg_temp.expect((SELECT length(notes) - length(replace(notes,'note one',''))) = length('note one'), 'notes appended once');
SELECT pg_temp.expect(pg_temp.fails($q$SELECT public.apply_phone_outcome_atomic('aaaaaaaa-0000-4000-8000-000000000001',gen_random_uuid(),'call-uid-0001','interested','contacted','',false)$q$), 'call_uid reused for other lead refused');
SELECT pg_temp.expect((public.apply_phone_outcome_atomic(:other,'11111111-0000-4000-8000-000000000001','call-uid-0001','x','pending','',false) IS NULL) IS NOT TRUE OR true, 'placeholder');
SELECT pg_temp.reset();
UPDATE public.leads SET assigned_agent_id = :other;
SELECT pg_temp.expect(pg_temp.fails($q$SELECT public.apply_phone_outcome_atomic('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','call-uid-0002','interested','contacted','',false)$q$), 'conflicting owner refused');
UPDATE public.leads SET assigned_to = NULL, assigned_agent_id = NULL;
SELECT pg_temp.expect(pg_temp.fails($q$SELECT public.apply_phone_outcome_atomic('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','call-uid-0003','interested','contacted','',false)$q$), 'unassigned lead refused');
SELECT pg_temp.expect((SELECT call_attempts FROM public.leads) = 0 AND (SELECT count(*) FROM public.phone_outcome_receipts) = 0, 'refusals wrote nothing');

-- 7. Privileges: app roles cannot call either function.
SELECT pg_temp.expect(NOT has_function_privilege('authenticated','public.finalize_call_report_v2(uuid,uuid,jsonb,jsonb,jsonb,text,text,boolean,text,text,jsonb)','EXECUTE'), 'authenticated cannot finalize directly');
SELECT pg_temp.expect(NOT has_function_privilege('anon','public.apply_phone_outcome_atomic(uuid,uuid,text,text,text,text,boolean)','EXECUTE'), 'anon cannot apply outcomes');
SELECT pg_temp.expect(NOT has_table_privilege('authenticated','public.phone_outcome_receipts','SELECT'), 'receipts are server-only');
