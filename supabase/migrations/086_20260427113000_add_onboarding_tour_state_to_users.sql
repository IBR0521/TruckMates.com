ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_tour_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_tour_completed_at TIMESTAMPTZ;
