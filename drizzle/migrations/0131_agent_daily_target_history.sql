CREATE TABLE public.agent_daily_target_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 agent_id uuid NOT NULL REFERENCES public.profiles(id),
 target integer NOT NULL CHECK (target BETWEEN 1 AND 50),
 effective_day date NOT NULL,
 actor_profile_id uuid REFERENCES public.profiles(id),
 actor_label text NOT NULL DEFAULT 'IT Console',
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.agent_daily_target_history TO service_role;
ALTER TABLE public.agent_daily_target_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX agent_daily_target_lookup ON public.agent_daily_target_history(agent_id, effective_day DESC, created_at DESC, id DESC);
CREATE TRIGGER agent_daily_target_immutable BEFORE UPDATE OR DELETE ON public.agent_daily_target_history FOR EACH ROW EXECUTE FUNCTION public.append_only_block();
COMMENT ON TABLE public.agent_daily_target_history IS 'Append-only allocation display targets, full IT PIN writes via server; hard 50 assignment cap and LeadHub routing unchanged. Effective day preserves earlier history.';