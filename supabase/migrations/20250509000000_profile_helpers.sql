create or replace function public.ensure_user_profile()
returns public.user_profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_profile public.user_profiles%rowtype;
  metadata jsonb;
  derived_full_name text;
begin
  select raw_user_meta_data into metadata from auth.users where id = auth.uid();
  derived_full_name := coalesce(metadata->> 'full_name', metadata->> 'name');

  select *
    into current_profile
  from public.user_profiles
  where id = auth.uid();

  if not found then
    insert into public.user_profiles (id, full_name)
      values (auth.uid(), derived_full_name)
      returning * into current_profile;
  elsif current_profile.full_name is null and derived_full_name is not null then
    update public.user_profiles
       set full_name = derived_full_name
     where id = auth.uid()
     returning * into current_profile;
  end if;

  return current_profile;
end;
$$;

revoke all on function public.ensure_user_profile() from public;
grant execute on function public.ensure_user_profile() to authenticated;

create or replace function public.is_username_available(target_username text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized text;
  conflicting_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  normalized := lower(nullif(trim(target_username), ''));
  if normalized is null then
    return false;
  end if;

  if char_length(normalized) < 3 or char_length(normalized) > 30 then
    return false;
  end if;

  if normalized !~ '^[a-z0-9_]+$' then
    return false;
  end if;

  select id
    into conflicting_id
  from public.user_profiles
  where lower(username) = normalized
    and id <> auth.uid()
  limit 1;

  return conflicting_id is null;
end;
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to authenticated;
