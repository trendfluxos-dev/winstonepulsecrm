-- PROPOSAL ONLY — NOT APPLIED. Review before any migration. Lives outside drizzle/migrations on purpose.
-- Server-only tables: RLS on, no client policies; access only through server functions.
-- Column names below are exactly what src/lib/messenger-store.server.ts and
-- src/lib/messenger-review.server.ts read and write, so applying this file is
-- the single step that turns the already-written pipeline from refusing to working.

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
  lead_id uuid,                     -- set only by the staff-confirmed review step
  delivery_status text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.messenger_messages TO service_role;
ALTER TABLE public.messenger_messages ENABLE ROW LEVEL SECURITY;

-- One row per event identity. payload_sha256 makes an exact replay return the
-- stored result while a changed payload under the same identity is rejected.
CREATE TABLE public.messenger_webhook_receipts (
  event_key text PRIMARY KEY,
  payload_sha256 text NOT NULL,
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

-- Append-only history, matching the CRM's existing no-rewrite rule for evidence.
CREATE OR REPLACE FUNCTION public.block_messenger_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Messenger history is append-only';
  END IF;
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME IN ('messenger_messages','messenger_thread_events','messenger_webhook_receipts') THEN
    -- A reviewed message may be linked to a lead exactly once; nothing else changes.
    IF TG_TABLE_NAME = 'messenger_messages' AND OLD.lead_id IS NULL AND NEW.lead_id IS NOT NULL
       AND NEW.thread_id = OLD.thread_id AND NEW.mid = OLD.mid AND NEW.body IS NOT DISTINCT FROM OLD.body
       AND NEW.direction = OLD.direction THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Messenger history is append-only';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER messenger_messages_append_only
  BEFORE UPDATE OR DELETE ON public.messenger_messages
  FOR EACH ROW EXECUTE FUNCTION public.block_messenger_history_mutation();

CREATE TRIGGER messenger_thread_events_append_only
  BEFORE UPDATE OR DELETE ON public.messenger_thread_events
  FOR EACH ROW EXECUTE FUNCTION public.block_messenger_history_mutation();

CREATE TRIGGER messenger_webhook_receipts_append_only
  BEFORE UPDATE OR DELETE ON public.messenger_webhook_receipts
  FOR EACH ROW EXECUTE FUNCTION public.block_messenger_history_mutation();

-- Still required before this file is applied:
-- 1. Authoritative Meta evidence: App Review + required permission tier, Live mode,
--    Page consent for messaging, and messages subscriptions at App and Page level.
-- 2. Owner decision on keeping the outbox (sending) in this migration or a later one.
-- 3. The MESSENGER_INGESTION_ENABLED server flag is set only after both are done.
