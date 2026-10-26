                              
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS application_fee numeric,
  ADD COLUMN IF NOT EXISTS fee_waiver_available boolean,
  ADD COLUMN IF NOT EXISTS travel_required boolean,
  ADD COLUMN IF NOT EXISTS equipment_needed text,
  ADD COLUMN IF NOT EXISTS format text;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_format_check
  CHECK (format IS NULL OR format IN ('virtual','in_person','hybrid'));

                                                               
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS foster_youth_status boolean,
  ADD COLUMN IF NOT EXISTS housing_insecure_status boolean,
  ADD COLUMN IF NOT EXISTS immigration_status_note text,
  ADD COLUMN IF NOT EXISTS cohort_id uuid,
  ADD COLUMN IF NOT EXISTS zero_barrier_filter_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS zero_barrier_filter_used boolean NOT NULL DEFAULT false;

                    
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'counselor';

                              
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email_digest_enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'weekly',
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_frequency_check CHECK (frequency IN ('weekly','daily'))
);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif prefs read own" ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif prefs insert own" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif prefs update own" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER notification_preferences_touch
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

             
CREATE TABLE IF NOT EXISTS public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id uuid NOT NULL,
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.cohorts TO authenticated;
GRANT ALL ON public.cohorts TO service_role;
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cohorts read own" ON public.cohorts
  FOR SELECT TO authenticated
  USING (counselor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cohorts insert own" ON public.cohorts
  FOR INSERT TO authenticated
  WITH CHECK (counselor_id = auth.uid() AND public.has_role(auth.uid(), 'counselor'::text::public.app_role));
CREATE POLICY "cohorts update own" ON public.cohorts
  FOR UPDATE TO authenticated
  USING (counselor_id = auth.uid()) WITH CHECK (counselor_id = auth.uid());

CREATE TRIGGER cohorts_touch
  BEFORE UPDATE ON public.cohorts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

                                                                       
CREATE OR REPLACE FUNCTION public.redeem_cohort_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cohort_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT id INTO _cohort_id FROM public.cohorts WHERE upper(invite_code) = upper(trim(_code));
  IF _cohort_id IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.profiles SET cohort_id = _cohort_id WHERE id = auth.uid();
  RETURN _cohort_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_cohort_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_cohort_code(text) TO authenticated;

                                                        
CREATE OR REPLACE FUNCTION public.counselor_cohort_stats(_cohort_id uuid)
RETURNS TABLE (
  students_onboarded integer,
  strong_matches integer,
  deadlines_this_week integer,
  zero_barrier_users integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.cohorts c
    WHERE c.id = _cohort_id
      AND (c.counselor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ) THEN
    RAISE EXCEPTION 'Not authorized for this cohort';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*)::int FROM public.profiles p WHERE p.cohort_id = _cohort_id AND p.onboarded),
    (SELECT count(*)::int FROM public.matches m
       JOIN public.profiles p ON p.id = m.user_id
      WHERE p.cohort_id = _cohort_id AND m.score >= 85 AND m.is_future = false),
    (SELECT count(DISTINCT o.id)::int FROM public.matches m
       JOIN public.profiles p ON p.id = m.user_id
       JOIN public.opportunities o ON o.id = m.opportunity_id
      WHERE p.cohort_id = _cohort_id
        AND o.deadline IS NOT NULL
        AND o.deadline BETWEEN current_date AND current_date + 7),
    (SELECT count(*)::int FROM public.profiles p
      WHERE p.cohort_id = _cohort_id AND p.zero_barrier_filter_used);
END;
$$;

REVOKE ALL ON FUNCTION public.counselor_cohort_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.counselor_cohort_stats(uuid) TO authenticated;

                                             
CREATE OR REPLACE FUNCTION public.impact_summary()
RETURNS TABLE (
  total_matches integer,
  total_applied integer,
  total_accepted integer,
  zero_barrier_users integer,
  students_served integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.matches),
    (SELECT count(*)::int FROM public.user_opportunities WHERE status = 'applied'),
    (SELECT count(*)::int FROM public.user_opportunities WHERE status = 'accepted'),
    (SELECT count(*)::int FROM public.profiles WHERE zero_barrier_filter_used),
    (SELECT count(*)::int FROM public.profiles WHERE onboarded);
$$;

GRANT EXECUTE ON FUNCTION public.impact_summary() TO anon, authenticated;