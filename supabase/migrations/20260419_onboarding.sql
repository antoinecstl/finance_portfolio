-- ============================================================
-- Onboarding flow: track when a user completed first-run setup
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Existing users are considered already onboarded (no forced replay)
UPDATE public.profiles
SET onboarded_at = COALESCE(onboarded_at, created_at, NOW())
WHERE onboarded_at IS NULL;
