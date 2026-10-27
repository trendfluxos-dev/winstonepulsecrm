ALTER TABLE public.runtime_error_occurrences
  ADD COLUMN IF NOT EXISTS recovery_outcome text
  CHECK (recovery_outcome IS NULL OR recovery_outcome IN ('reloading','recovered','failed'));