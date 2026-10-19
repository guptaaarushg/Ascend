ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dream_colleges text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_colleges text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS safety_colleges text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intended_major text,
  ADD COLUMN IF NOT EXISTS applying_with_financial_aid boolean,
  ADD COLUMN IF NOT EXISTS needs_full_ride boolean,
  ADD COLUMN IF NOT EXISTS college_application_year text,
  ADD COLUMN IF NOT EXISTS college_notes text;