-- Local-only proposal validation, after existing atomic regression tests.
ALTER TABLE public.call_reports ADD COLUMN updated_at timestamptz;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
\ir ../../drizzle/migrations/0138_unified_call_qualification_triggers.sql
CREATE TRIGGER report_validation BEFORE INSERT OR UPDATE ON public.call_reports
  FOR EACH ROW EXECUTE FUNCTION public.validate_call_report();
CREATE TRIGGER lead_completion BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lead_completion();

SELECT pg_temp.reset();
CREATE FUNCTION pg_temp.sales(_grade text, _answers jsonb, _score integer, _temperature text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.finalize_call_report_v2('22222222-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',
 jsonb_build_object('category','interested','connected',true,'summary','Synthetic qualification','grade',_grade,
 'evaluation_answers',_answers,'evaluation_score',_score,'temperature',_temperature),
 jsonb_build_object('status','contacted','work_state','completed','grade',_grade,'temperature',_temperature),
 NULL,NULL,NULL,true,'synthetic evaluation','synthetic outcome','{}');
$$;
\set yes '''{"project_interest":true,"asked_price":true,"wanted_info":true,"visit_interest":true,"decision_30d":true,"wants_follow_up":true}''::jsonb'
\set no '''{"project_interest":false,"asked_price":false,"wanted_info":false,"visit_interest":false,"decision_30d":false,"wants_follow_up":false}''::jsonb'
SELECT pg_temp.expect((pg_temp.sales('D',:yes,90,'hot')->>'alreadySubmitted')::boolean=false,'all yes 90 HOT manual D commits');
SELECT pg_temp.expect((SELECT evaluation_score=90 AND temperature='hot' AND grade='D' FROM public.call_reports),'saved score and independent grade');
SELECT pg_temp.expect((pg_temp.sales('A',:yes,90,'hot')->>'alreadySubmitted')::boolean=true,'duplicate returns without rescoring');
SELECT pg_temp.expect((SELECT count(*)=1 FROM public.lead_classifications),'duplicate creates no second classification');
SELECT pg_temp.reset();
SELECT pg_temp.expect((pg_temp.sales('A',:no,0,'cold')->>'alreadySubmitted')::boolean=false,'all no zero COLD commits');
SELECT pg_temp.reset();
SELECT pg_temp.expect(pg_temp.fails($$SELECT pg_temp.sales('A','{"project_interest":true}',90,'hot')$$),'DB rejects missing raw answers');
SELECT pg_temp.untouched('missing answers rollback');
SELECT pg_temp.expect(pg_temp.fails($$SELECT pg_temp.sales(NULL,'{}',0,'cold')$$),'DB rejects missing grade');
SELECT pg_temp.expect(pg_temp.fails($$SELECT pg_temp.sales('F','{}',0,'cold')$$),'DB rejects invalid grade');
SELECT pg_temp.expect(pg_temp.fails('SELECT pg_temp.sales(''B'','||quote_literal(:yes)||'::jsonb,0,''cold'')'),'DB rejects forged score/temperature');
SELECT pg_temp.reset();
SELECT public.finalize_call_report_v2('22222222-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',
 '{"category":"wrong_number","connected":true,"summary":"Fake / Invalid contact","reason":"Fake / Invalid contact","interest":"fake"}',
 '{"status":"closed","outcome_category":"wrong_number","work_state":"completed"}',NULL,NULL,NULL,false,NULL,'Fast Disqualification','{}');
SELECT pg_temp.expect((SELECT status='submitted' AND evaluation_score IS NULL AND temperature IS NULL AND grade IS NULL FROM public.call_reports),'connected rejection has no fabricated score/grade');
SELECT pg_temp.expect((SELECT work_state='completed' FROM public.leads),'rejection completes work without qualification');
SELECT pg_temp.expect((SELECT count(*)=0 FROM public.lead_classifications),'rejection does not append sales classification');
SELECT pg_temp.expect((SELECT count(*)=1 FROM public.lead_events),'actual rejection timeline retained');
SELECT pg_temp.expect((SELECT count(*)=1 FROM public.audit_logs),'rejection audit retained');