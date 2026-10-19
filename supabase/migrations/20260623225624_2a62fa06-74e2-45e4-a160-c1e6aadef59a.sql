ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected'));

UPDATE public.opportunities SET status = 'approved' WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS opportunities_status_idx ON public.opportunities(status);

DROP POLICY IF EXISTS "Opportunities are readable by everyone" ON public.opportunities;
DROP POLICY IF EXISTS "Opportunities readable" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities_read" ON public.opportunities;
DROP POLICY IF EXISTS "Admins manage opportunities" ON public.opportunities;

CREATE POLICY "Approved opportunities readable by authenticated"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (status = 'approved' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage opportunities"
  ON public.opportunities FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));