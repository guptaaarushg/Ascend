alter table public.opportunities
  add column if not exists link_status text not null default 'unchecked',
  add column if not exists link_checked_at timestamptz,
  add column if not exists link_fail_count integer not null default 0;

alter table public.opportunities
  drop constraint if exists opportunities_link_status_check;

alter table public.opportunities
  add constraint opportunities_link_status_check
  check (link_status in ('unchecked', 'ok', 'broken', 'unknown'));

create index if not exists opportunities_link_checked_idx
  on public.opportunities (link_checked_at nulls first);
