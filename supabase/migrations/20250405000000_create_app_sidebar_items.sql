create extension if not exists "pgcrypto";

create table if not exists public.app_sidebar_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  route text not null,
  access_level text not null default 'public' check (access_level in ('public','user','admin')),
  is_enabled boolean not null default true,
  icon_name text,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint app_sidebar_items_route_unique unique (route)
);

drop trigger if exists app_sidebar_items_set_updated_at on public.app_sidebar_items;
create trigger app_sidebar_items_set_updated_at
before update on public.app_sidebar_items
for each row
execute function public.set_updated_at();

alter table public.app_sidebar_items enable row level security;

create policy if not exists "App sidebar items select"
  on public.app_sidebar_items
  for select
  using (true);

create policy if not exists "App sidebar items manage"
  on public.app_sidebar_items
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
