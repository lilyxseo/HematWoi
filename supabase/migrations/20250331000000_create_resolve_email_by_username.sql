create or replace function public.resolve_email_by_username(username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
  matched_email text;
begin
  normalized_username := lower(nullif(trim(username), ''));
  if normalized_username is null then
    return null;
  end if;

  select u.email
    into matched_email
  from auth.users u
  join public.user_profiles p on p.id = u.id
  where p.username is not null
    and lower(p.username) = normalized_username
  limit 1;

  return matched_email;
end;
$$;

grant execute on function public.resolve_email_by_username(text) to authenticated;
