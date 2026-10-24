-- PROPOSAL ONLY — NOT APPLIED. Review before any migration. Lives outside drizzle/migrations on purpose.
-- Server-only tables: RLS on, no client policies; access via server functions.

CREATE TABLE public.meta_page_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id text NOT NULL UNIQUE,
  page_name text,
  token_ciphertext text,            -- encrypted server-side; never returned to clients
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  connected_by uuid,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_validated_at timestamptz
);
GRANT ALL ON public.meta_page_connections TO service_role;
ALTER TABLE public.meta_page_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messenger_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id text NOT NULL,
  psid text NOT NULL,
  lead_id uuid,
  assigned_agent_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  unread_count integer NOT NULL DEFAULT 0,
  last_inbound_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, psid)
);
GRANT ALL ON public.messenger_threads TO service_role;
ALTER TABLE public.messenger_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messenger_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.messenger_threads(id),
  mid text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  body text,
  sent_by uuid,
  delivery_status text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.messenger_messages TO service_role;
ALTER TABLE public.messenger_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messenger_webhook_receipts (
  event_key text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT ALL ON public.messenger_webhook_receipts TO service_role;
ALTER TABLE public.messenger_webhook_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messenger_thread_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.messenger_threads(id),
  actor uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.messenger_thread_events TO service_role;
ALTER TABLE public.messenger_thread_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messenger_outbox (
  request_id uuid PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.messenger_threads(id),
  body text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  last_error text,
  sent_mid text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.messenger_outbox TO service_role;
ALTER TABLE public.messenger_outbox ENABLE ROW LEVEL SECURITY;
-- TODO before applying: append-only triggers on messages/events, matching existing block_history_mutation().
