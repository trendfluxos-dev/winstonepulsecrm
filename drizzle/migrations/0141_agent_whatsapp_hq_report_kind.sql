ALTER TABLE public.agent_whatsapp_alerts DROP CONSTRAINT IF EXISTS agent_whatsapp_alerts_kind_check;
ALTER TABLE public.agent_whatsapp_alerts ADD CONSTRAINT agent_whatsapp_alerts_kind_check
  CHECK (kind IN ('new_leads','daily_progress','test','hq_report'));