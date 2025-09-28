-- Ensure user_profiles has role and is_active columns for admin management
alter table public.user_profiles
  add column if not exists role text not null default 'user' check (role in ('user','admin')),
  add column if not exists is_active boolean not null default true;

create index if not exists user_profiles_role_idx on public.user_profiles (role);
create index if not exists user_profiles_is_active_idx on public.user_profiles (is_active);

-- Audit log table for admin actions
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  target_user_id uuid not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_audit_logs_admin_id_idx on public.admin_audit_logs (admin_id);
create index if not exists admin_audit_logs_target_user_id_idx on public.admin_audit_logs (target_user_id);

-- Helper view/function to list users with joined profile details
create or replace function public.admin_list_users(
  search text default null,
  role text default null,
  status text default null,
  limit_count integer default 20,
  offset_count integer default 0,
  order_field text default 'created_at',
  order_direction text default 'desc'
)
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  identities jsonb,
  profile_role text,
  profile_is_active boolean,
  profile_full_name text,
  profile_username text,
  profile_avatar_url text,
  profile_locale text,
  profile_timezone text,
  profile_theme text,
  total_count bigint
)
security definer
set search_path = public, extensions
language sql
as $$
  select
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    coalesce(u.identities, '[]'::jsonb) as identities,
    p.role as profile_role,
    p.is_active as profile_is_active,
    p.full_name as profile_full_name,
    p.username as profile_username,
    p.avatar_url as profile_avatar_url,
    p.locale as profile_locale,
    p.timezone as profile_timezone,
    p.theme as profile_theme,
    count(*) over () as total_count
  from auth.users u
  join public.user_profiles p on p.id = u.id
  where
    (coalesce(role, '') = '' or role = 'all' or p.role = role)
    and (
      coalesce(status, '') = '' or status = 'all' or
      (status = 'active' and coalesce(p.is_active, true) is true) or
      (status = 'inactive' and coalesce(p.is_active, false) is false)
    )
    and (
      coalesce(search, '') = '' or
      u.email ilike '%' || search || '%' or
      coalesce(p.username, '') ilike '%' || search || '%' or
      coalesce(p.full_name, '') ilike '%' || search || '%'
    )
  order by
    case when order_field = 'email' and lower(order_direction) = 'asc' then u.email end asc nulls last,
    case when order_field = 'email' and lower(order_direction) = 'desc' then u.email end desc nulls last,
    case when order_field = 'last_sign_in_at' and lower(order_direction) = 'asc' then u.last_sign_in_at end asc nulls last,
    case when order_field = 'last_sign_in_at' and lower(order_direction) = 'desc' then u.last_sign_in_at end desc nulls last,
    case when order_field = 'created_at' and lower(order_direction) = 'asc' then u.created_at end asc nulls last,
    case when order_field = 'created_at' and lower(order_direction) = 'desc' then u.created_at end desc nulls last,
    u.created_at desc
  limit greatest(limit_count, 1)
  offset greatest(offset_count, 0);
$$;
