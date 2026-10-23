create or replace function public.catalog_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.opportunities where status = 'approved';
$$;

grant execute on function public.catalog_count() to anon, authenticated;
