-- Retention for Messenger data (owner-authorized 2026-10-25):
-- message bodies 90 days, thread events and webhook receipts 180 days.
-- The append-only trigger keeps its protection for everything newer; only the
-- scheduled cleanup may delete rows past the retention window. Updates stay blocked.
CREATE OR REPLACE FUNCTION public.block_messenger_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Retention exception: only rows past the retention window may be removed,
    -- and only by the scheduled cleanup path.
    IF TG_TABLE_NAME = 'messenger_messages' AND OLD.created_at < now() - interval '90 days' THEN
      RETURN OLD;
    END IF;
    IF TG_TABLE_NAME = 'messenger_thread_events' AND OLD.created_at < now() - interval '180 days' THEN
      RETURN OLD;
    END IF;
    IF TG_TABLE_NAME = 'messenger_webhook_receipts' AND OLD.received_at < now() - interval '180 days' THEN
      RETURN OLD;
    END IF;
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