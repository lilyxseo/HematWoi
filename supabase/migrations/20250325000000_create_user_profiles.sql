create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  currency text not null default 'IDR',
  locale text not null default 'id-ID',
  date_format text not null default 'DD/MM/YYYY',
  timezone text not null default 'Asia/Jakarta',
  theme text not null default 'system' check (theme in ('system','light','dark')),
  notifications jsonb not null default '{"weekly_summary":true,"monthly_summary":false,"bill_due":true,"goal_reminder":true}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_profiles_username_check check (
    username is null or char_length(trim(username)) between 3 and 30
  )
);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select
  on public.user_profiles
  for select
  using (id = auth.uid());

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update
  on public.user_profiles
  for update
  using (id = auth.uid());

drop policy if exists user_profiles_insert on public.user_profiles;
create policy user_profiles_insert
  on public.user_profiles
  for insert
  with check (id = auth.uid());
