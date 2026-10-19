ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_discovered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_matches_user_id ON public.matches (user_id);
CREATE INDEX IF NOT EXISTS idx_user_opportunities_user_id ON public.user_opportunities (user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status_deadline ON public.opportunities (status, deadline);