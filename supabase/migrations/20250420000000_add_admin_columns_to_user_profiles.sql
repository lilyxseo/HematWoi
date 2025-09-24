alter table public.user_profiles
  add column if not exists email text,
  add column if not exists role text not null default 'user' check (role in ('user','admin')),
  add column if not exists is_active boolean not null default true;

create index if not exists user_profiles_role_idx on public.user_profiles (role);
create index if not exists user_profiles_is_active_idx on public.user_profiles (is_active);
