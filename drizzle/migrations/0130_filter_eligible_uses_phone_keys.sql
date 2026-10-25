-- 0130: The daily lead hand-out timed out once the head pool grew past ~2,000
-- usable rows. Every eligibility check (the filter_eligible_lead_ids rpc, also
-- fired per-row by the leads_first_assignment_eligibility trigger) re-derived
-- EVERY lead's phones with a full-table CROSS JOIN LATERAL extract_bd_phones
-- scan (all_phones). One 300-lead batch ran > 8s and the assignment statement
-- blew the statement timeout, so the 09:10 Dhaka auto hand-out silently failed
-- from 2026-10-24. The same rules now match phones through the indexed
-- lead_phone_keys table; eligibility semantics are unchanged. Legacy leads
-- created before the key index existed are backfilled first (additive only).
INSERT INTO public.lead_phone_keys (canonical_phone, lead_id)
SELECT p.phone, l.id
FROM public.leads l
CROSS JOIN LATERAL public.extract_bd_phones(l.phone_number) p(phone)
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_phone_keys k
  WHERE k.lead_id = l.id AND k.canonical_phone = p.phone
)
ON CONFLICT (canonical_phone) DO NOTHING;

CREATE OR REPLACE FUNCTION public.filter_eligible_lead_ids(_lead_ids uuid[])
 RETURNS TABLE(lead_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH target AS MATERIALIZED (
    SELECT l.id, p.phone
    FROM public.leads l
    CROSS JOIN LATERAL public.extract_bd_phones(l.phone_number) p(phone)
    WHERE l.id = ANY(_lead_ids)
      AND l.assigned_to IS NULL
      AND l.assigned_agent_id IS NULL
      AND coalesce(l.call_count, 0) = 0
      AND coalesce(l.call_attempts, 0) = 0
      AND l.last_call_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.call_reports cr WHERE cr.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.call_recordings rec WHERE rec.lead_id = l.id)
      AND (
        public.lead_is_recalled_untouched(l.id)
        OR (NOT EXISTS (SELECT 1 FROM public.lead_assignments la WHERE la.lead_id = l.id)
            AND NOT EXISTS (SELECT 1 FROM public.lead_events le WHERE le.lead_id = l.id))
      )
  ),
  candidates AS MATERIALIZED (
    SELECT DISTINCT k.lead_id AS id, k.canonical_phone AS phone
    FROM public.lead_phone_keys k
    JOIN (SELECT DISTINCT phone FROM target) tp ON tp.phone = k.canonical_phone
  ),
  worked_phones AS (
    SELECT DISTINCT c.phone FROM candidates c WHERE public.lead_has_work_history(c.id)
  )
  SELECT DISTINCT t.id
  FROM target t
  WHERE NOT EXISTS (SELECT 1 FROM worked_phones wp WHERE wp.phone = t.phone)
$function$;
