
-- Pin search_path on touch_updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

-- handle_new_user runs from auth trigger only — revoke direct callability
revoke execute on function public.handle_new_user() from public, anon, authenticated;
