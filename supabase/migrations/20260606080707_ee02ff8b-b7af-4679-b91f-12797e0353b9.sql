
-- Restrict who can execute the SECURITY DEFINER has_role function.
-- It must remain SECURITY DEFINER (it's used inside RLS policies to avoid
-- recursion on user_roles), but anon should not be able to call it directly,
-- and we keep authenticated callers since RLS policies evaluate as the user.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Add admin-only write policies on user_roles to prevent privilege escalation.
-- Currently only a SELECT policy exists, allowing any authenticated user to
-- INSERT a row granting themselves 'admin'.
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
