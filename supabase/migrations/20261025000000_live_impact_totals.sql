-- Corrected inclusive beta totals, supplied by the project owner:
-- 1,134 onboarded students; 60,206 student/opportunity matches; 982 acceptances.
-- Run once in Supabase SQL Editor BEFORE deploying the frontend. Rerunning does not reset totals.
-- Existing records are included in the starting totals, not added to them.
BEGIN;

-- Freeze writes briefly while taking the initial inventory and installing triggers.
LOCK TABLE public.profiles, public.matches, public.user_opportunities
  IN SHARE ROW EXCLUSIVE MODE;

CREATE SCHEMA IF NOT EXISTS ascend_internal;
REVOKE ALL ON SCHEMA ascend_internal FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS ascend_internal.impact_totals (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  students integer NOT NULL CHECK (students >= 0),
  matches integer NOT NULL CHECK (matches >= 0),
  accepted integer NOT NULL CHECK (accepted >= 0),
  activated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ascend_internal.impact_totals (singleton, students, matches, accepted)
VALUES (true, 1134, 60206, 982)
ON CONFLICT (singleton) DO NOTHING;

-- No foreign keys: preserve deduplication history when an operational record is removed.
-- IDs stay private; the public RPC exposes aggregate totals only.
CREATE TABLE IF NOT EXISTS ascend_internal.impact_seen (
  metric text NOT NULL CHECK (metric IN ('students', 'matches', 'accepted')),
  user_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  PRIMARY KEY (metric, user_id, opportunity_id)
);
ALTER TABLE ascend_internal.impact_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ascend_internal.impact_seen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ascend_internal FROM PUBLIC, anon, authenticated;

-- Snapshot existing entities without increasing the supplied inclusive baseline.
INSERT INTO ascend_internal.impact_seen (metric, user_id, opportunity_id)
SELECT 'students', id, '00000000-0000-0000-0000-000000000000'::uuid
FROM public.profiles WHERE onboarded
ON CONFLICT DO NOTHING;
INSERT INTO ascend_internal.impact_seen (metric, user_id, opportunity_id)
SELECT 'matches', user_id, opportunity_id FROM public.matches
ON CONFLICT DO NOTHING;
INSERT INTO ascend_internal.impact_seen (metric, user_id, opportunity_id)
SELECT 'accepted', user_id, opportunity_id
FROM public.user_opportunities WHERE status = 'accepted'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION ascend_internal.record_impact_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  event_metric text;
  event_user uuid;
  event_opportunity uuid;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.onboarded IS DISTINCT FROM true THEN RETURN NEW; END IF;
    event_metric := 'students';
    event_user := NEW.id;
    event_opportunity := '00000000-0000-0000-0000-000000000000'::uuid;
  ELSIF TG_TABLE_NAME = 'matches' THEN
    event_metric := 'matches';
    event_user := NEW.user_id;
    event_opportunity := NEW.opportunity_id;
  ELSIF TG_TABLE_NAME = 'user_opportunities' THEN
    IF NEW.status::text IS DISTINCT FROM 'accepted' THEN RETURN NEW; END IF;
    event_metric := 'accepted';
    event_user := NEW.user_id;
    event_opportunity := NEW.opportunity_id;
  ELSE
    RAISE EXCEPTION 'Unexpected impact trigger source';
  END IF;

  INSERT INTO ascend_internal.impact_seen (metric, user_id, opportunity_id)
  VALUES (event_metric, event_user, event_opportunity)
  ON CONFLICT DO NOTHING;
  IF FOUND THEN
    -- Atomic increments; simultaneous requests cannot overwrite each other's counts.
    UPDATE ascend_internal.impact_totals
    SET students = students + CASE WHEN event_metric = 'students' THEN 1 ELSE 0 END,
        matches = matches + CASE WHEN event_metric = 'matches' THEN 1 ELSE 0 END,
        accepted = accepted + CASE WHEN event_metric = 'accepted' THEN 1 ELSE 0 END
    WHERE singleton = true;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ascend_internal.record_impact_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ascend_count_students ON public.profiles;
CREATE TRIGGER ascend_count_students
AFTER INSERT OR UPDATE OF onboarded ON public.profiles
FOR EACH ROW EXECUTE FUNCTION ascend_internal.record_impact_event();

DROP TRIGGER IF EXISTS ascend_count_matches ON public.matches;
CREATE TRIGGER ascend_count_matches
AFTER INSERT OR UPDATE OF user_id, opportunity_id ON public.matches
FOR EACH ROW EXECUTE FUNCTION ascend_internal.record_impact_event();

DROP TRIGGER IF EXISTS ascend_count_acceptances ON public.user_opportunities;
CREATE TRIGGER ascend_count_acceptances
AFTER INSERT OR UPDATE OF status, user_id, opportunity_id ON public.user_opportunities
FOR EACH ROW EXECUTE FUNCTION ascend_internal.record_impact_event();

-- Keep the existing RPC's name, result types, and column order for compatibility.
-- Applications started and zero-barrier metrics retain their existing database logic.
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
SET search_path = pg_catalog
AS $$
  SELECT t.matches,
    (SELECT count(*)::integer FROM public.user_opportunities WHERE status = 'applied'),
    t.accepted,
    (SELECT count(*)::integer FROM public.profiles WHERE zero_barrier_filter_used),
    t.students
  FROM ascend_internal.impact_totals AS t WHERE t.singleton = true;
$$;
REVOKE ALL ON FUNCTION public.impact_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.impact_summary() TO anon, authenticated;

COMMIT;

-- Expected initial values: students_served=1134, total_matches=60206, total_accepted=982.
SELECT * FROM public.impact_summary();
