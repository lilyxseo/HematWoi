create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_settings_updated_at_idx on public.app_settings (updated_at desc);

alter table public.app_settings enable row level security;

create policy if not exists "App settings select"
  on public.app_settings
  for select
  using (true);

create policy if not exists "App settings manage"
  on public.app_settings
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.role = 'admin'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.role = 'admin'
    )
  );

-- ensure updated_at is refreshed on modifications
create extension if not exists "pgcrypto";

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();
