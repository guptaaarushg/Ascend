
-- ROLES
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "users read own roles"
on public.user_roles for select
to authenticated
using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- PROFILES (life profile)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age_range text,
  education_level text,
  location text,
  country text,
  academic_interests text[] not null default '{}',
  career_interests text[] not null default '{}',
  skills text[] not null default '{}',
  extracurriculars text[] not null default '{}',
  certifications text[] not null default '{}',
  languages text[] not null default '{}',
  professional_experience text,
  socioeconomic_info text,
  long_term_goals text,
  bio text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "profiles select own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid());

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- OPPORTUNITIES
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  organization text not null,
  category text not null, -- scholarship, grant, internship, competition, mentorship, job, research, benefit, community, funding
  description text not null,
  eligibility text not null,
  location text,
  remote boolean not null default false,
  deadline date,
  value_usd numeric,
  url text,
  tags text[] not null default '{}',
  related_skills text[] not null default '{}',
  related_orgs text[] not null default '{}',
  pathway_unlocks text[] not null default '{}',
  competitiveness text, -- low, medium, high
  underrepresented boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.opportunities to anon, authenticated;
grant insert, update, delete on public.opportunities to authenticated;
grant all on public.opportunities to service_role;

alter table public.opportunities enable row level security;

create policy "opportunities readable by all" on public.opportunities
for select to anon, authenticated using (true);

create policy "opportunities admin write" on public.opportunities
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- MATCHES (AI-cached scores)
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  reasoning text not null,
  why_qualify text,
  generated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

grant select, insert, update, delete on public.matches to authenticated;
grant all on public.matches to service_role;

alter table public.matches enable row level security;

create policy "matches read own" on public.matches for select to authenticated using (user_id = auth.uid());
create policy "matches insert own" on public.matches for insert to authenticated with check (user_id = auth.uid());
create policy "matches update own" on public.matches for update to authenticated using (user_id = auth.uid());
create policy "matches delete own" on public.matches for delete to authenticated using (user_id = auth.uid());

-- USER_OPPORTUNITIES (saved/applied/accepted)
create type public.opportunity_status as enum ('saved', 'applied', 'accepted', 'declined');

create table public.user_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  status opportunity_status not null default 'saved',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

grant select, insert, update, delete on public.user_opportunities to authenticated;
grant all on public.user_opportunities to service_role;

alter table public.user_opportunities enable row level security;

create policy "user_opps read own" on public.user_opportunities for select to authenticated using (user_id = auth.uid());
create policy "user_opps insert own" on public.user_opportunities for insert to authenticated with check (user_id = auth.uid());
create policy "user_opps update own" on public.user_opportunities for update to authenticated using (user_id = auth.uid());
create policy "user_opps delete own" on public.user_opportunities for delete to authenticated using (user_id = auth.uid());

-- updated_at trigger helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger opportunities_touch before update on public.opportunities for each row execute function public.touch_updated_at();
create trigger user_opportunities_touch before update on public.user_opportunities for each row execute function public.touch_updated_at();
