DROP POLICY IF EXISTS "opportunities readable by all" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities admin write" ON public.opportunities;
REVOKE SELECT ON public.opportunities FROM anon;