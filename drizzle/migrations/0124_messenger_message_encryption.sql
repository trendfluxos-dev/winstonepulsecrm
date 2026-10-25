-- Server-side encryption at rest for Messenger message bodies.
-- Additive only: new nullable ciphertext column; plaintext column stays as a
-- legacy fallback for rows stored before encryption and is marked deprecated.
ALTER TABLE public.messenger_messages ADD COLUMN body_ciphertext text;
COMMENT ON COLUMN public.messenger_messages.body IS 'DEPRECATED: plaintext fallback for rows stored before encryption; new writes use body_ciphertext';
COMMENT ON COLUMN public.messenger_messages.body_ciphertext IS 'AES-256-GCM ciphertext, format v1.<iv>.<ct> base64url; decrypted only server-side with MESSENGER_MESSAGE_KEY';

-- Read-only delivery diagnostics: pending receipts and unsent outbox retries.
CREATE INDEX messenger_webhook_receipts_unprocessed_idx ON public.messenger_webhook_receipts (received_at) WHERE processed_at IS NULL;
CREATE INDEX messenger_outbox_retry_idx ON public.messenger_outbox (next_retry_at) WHERE sent_mid IS NULL;