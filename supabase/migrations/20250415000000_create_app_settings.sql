create extension if not exists "pgcrypto";

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.app_settings (key, value)
select
  'app_info',
  jsonb_build_object(
    'title', coalesce(
      (select value ->> 'title' from public.app_settings where key = 'app_info'),
      'HematWoi'
    ),
    'tagline', coalesce((select value ->> 'tagline' from public.app_settings where key = 'app_info'), ''),
    'description', coalesce(
      (select value ->> 'description' from public.app_settings where key = 'app_info'),
      (select value ->> 'text' from public.app_settings where key = 'app_description'),
      ''
    ),
    'logo_url', coalesce((select value ->> 'logo_url' from public.app_settings where key = 'app_info'), ''),
    'favicon_url', coalesce((select value ->> 'favicon_url' from public.app_settings where key = 'app_info'), '')
  )
where not exists (
  select 1 from public.app_settings where key = 'app_info'
);

insert into public.app_settings (key, value)
select 'branding', jsonb_build_object(
    'primary', '#1e40af',
    'secondary', '#0ea5e9'
  )
where not exists (
  select 1 from public.app_settings where key = 'branding'
);

insert into public.app_settings (key, value)
select
  'app_description',
  jsonb_build_object(
    'text', coalesce(
      (select value ->> 'text' from public.app_settings where key = 'app_description'),
      (select value ->> 'description' from public.app_settings where key = 'app_info'),
      ''
    )
  )
where not exists (
  select 1 from public.app_settings where key = 'app_description'
);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

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
