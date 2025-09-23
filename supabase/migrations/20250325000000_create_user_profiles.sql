create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text null,
  username text unique null check (char_length(trim(username)) between 3 and 30),
  avatar_url text null,
  currency text not null default 'IDR',
  locale text not null default 'id-ID',
  date_format text not null default 'DD/MM/YYYY',
  timezone text not null default 'Asia/Jakarta',
  theme text not null default 'system' check (theme in ('system','light','dark')),
  notifications jsonb not null default '{"weekly_summary":true,"monthly_summary":false,"bill_due":true,"goal_reminder":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_profiles_username_unique on public.user_profiles (lower(username)) where username is not null;

alter table public.user_profiles enable row level security;

drop policy if exists "Users view own profile" on public.user_profiles;
create policy "Users view own profile" on public.user_profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.user_profiles;
create policy "Users insert own profile" on public.user_profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.user_profiles;
create policy "Users update own profile" on public.user_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users delete own profile" on public.user_profiles;
create policy "Users delete own profile" on public.user_profiles
  for delete
  using (auth.uid() = id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row
  execute function public.set_updated_at();
