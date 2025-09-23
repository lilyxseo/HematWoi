create or replace function public.resolve_email_by_username(username text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_email text;
begin
  if username is null or length(trim(username)) = 0 then
    return null;
  end if;

  select u.email
    into target_email
  from public.user_profiles p
    join auth.users u on u.id = p.id
  where p.username is not null
    and lower(p.username) = lower(username)
  limit 1;

  if target_email is null then
    return null;
  end if;

  return trim(target_email);
end;
$$;

revoke all on function public.resolve_email_by_username(text) from public;
grant execute on function public.resolve_email_by_username(text) to anon;
grant execute on function public.resolve_email_by_username(text) to authenticated;
