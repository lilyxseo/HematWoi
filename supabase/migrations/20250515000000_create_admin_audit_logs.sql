create extension if not exists "pgcrypto";

alter table public.user_profiles
  add column if not exists role text not null default 'user' check (role in ('user','admin')),
  add column if not exists is_active boolean not null default true;

update public.user_profiles
set role = coalesce(nullif(trim(role), ''), 'user'),
    is_active = coalesce(is_active, true);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_user_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_audit_logs_admin_id_idx on public.admin_audit_logs(admin_id);
create index if not exists admin_audit_logs_target_user_idx on public.admin_audit_logs(target_user_id);

insert into public.app_sidebar_items (title, route, access_level, icon_name, position)
values ('Users', '/admin/users', 'admin', 'users', 900)
on conflict (route) do update set
  title = excluded.title,
  access_level = excluded.access_level,
  icon_name = excluded.icon_name,
  position = excluded.position,
  updated_at = timezone('utc', now());
