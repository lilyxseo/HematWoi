do $$
begin
  alter table public.user_profiles add column role text;
exception
  when duplicate_column then null;
end $$;

do $$
begin
  alter table public.user_profiles add column is_active boolean;
exception
  when duplicate_column then null;
end $$;

update public.user_profiles
set role = coalesce(nullif(trim(role), ''), 'user');

update public.user_profiles
set is_active = coalesce(is_active, true);

alter table public.user_profiles
  alter column role set default 'user';

alter table public.user_profiles
  alter column role set not null;

alter table public.user_profiles
drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check check (role in ('user', 'admin'));

alter table public.user_profiles
  alter column is_active set default true;

alter table public.user_profiles
  alter column is_active set not null;

create index if not exists user_profiles_role_idx on public.user_profiles(role);
create index if not exists user_profiles_is_active_idx on public.user_profiles(is_active);
